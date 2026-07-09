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
  private defaultTTL: number;

  constructor(defaultTTLSeconds = 60) {
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTTL / 1000) * 1000;
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
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
