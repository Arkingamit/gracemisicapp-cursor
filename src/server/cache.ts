/**
 * Simple in-memory server-side cache with TTL support.
 * Used to avoid hitting MongoDB on every API request.
 * 
 * Cache is invalidated automatically after TTL expires,
 * or manually when songs are created/updated/deleted.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private defaultTTL: number;
  private maxEntries: number;

  constructor(defaultTTLSeconds = 60, maxEntries = 500) {
    this.defaultTTL = defaultTTLSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    // LRU touch: Map preserves insertion order, so re-inserting marks this
    // key as most-recently-used and protects it from eviction.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTTL / 1000) * 1000;
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      this.evict();
    }
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Frees room for a new entry. Cache keys are partly derived from request
   * parameters, so without a size cap an attacker could grow the cache
   * unboundedly by varying query params. Drops expired entries first, then
   * the least-recently-used one.
   */
  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  /**
   * Cache-aside with request coalescing: on a miss, concurrent callers for
   * the same key share a single loader invocation instead of each hitting
   * the database (per-process stampede protection).
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = (async () => {
      try {
        const data = await loader();
        this.set(key, data, ttlSeconds);
        return data;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Invalidate a specific key or all keys matching a prefix.
   */
  invalidate(keyOrPrefix: string): void {
    // Exact match
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
    }
    
    // Prefix match (e.g., invalidate all "songs:" keys)
    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Invalidate ALL cached data. Use when bulk changes happen.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache stats for debugging.
   */
  stats() {
    let active = 0;
    let expired = 0;
    const now = Date.now();
    
    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) expired++;
      else active++;
    }
    
    return { total: this.store.size, active, expired };
  }
}

// Global cache instance — persists across API requests in the same Node.js process.
// In development with HMR, we attach to `global` to survive hot reloads.
const globalWithCache = global as typeof globalThis & {
  _appCache?: MemoryCache;
};

if (!globalWithCache._appCache) {
  globalWithCache._appCache = new MemoryCache(60); // 60 second default TTL
}

export const appCache = globalWithCache._appCache;
