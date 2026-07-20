import type { Collection } from 'mongodb';
import { connectToDatabase } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

/**
 * MongoDB-backed rate-limit store.
 *
 * Why MongoDB and not the in-memory cache: on serverless (Vercel) each lambda
 * instance has its own memory, so an in-memory counter cannot enforce a global
 * limit. MongoDB is shared across instances and already available here.
 *
 * We bypass the dual-write Atlas proxy (`getCollection`) on purpose — these are
 * ephemeral, high-churn counters that must not be mirrored to the backup DB.
 * A TTL index auto-expires stale documents.
 *
 * All operations FAIL OPEN: if MongoDB is unavailable we prefer availability
 * over blocking legitimate traffic, and log the error.
 */

interface WindowDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

interface ThrottleDoc {
  _id: string;
  failures: number;
  firstFailureAt: Date;
  lastFailureAt: Date;
  nextAllowedAt: Date;
  expiresAt: Date;
}

let indexesReady: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await connectToDatabase();
      await Promise.all([
        db
          .collection(COLLECTIONS.RATE_LIMITS)
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db
          .collection(COLLECTIONS.AUTH_THROTTLE)
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]);
    })().catch((err) => {
      // Reset so a later call can retry index creation.
      indexesReady = null;
      console.error('[rateLimit] Failed to ensure TTL indexes:', err);
    });
  }
  return indexesReady ?? Promise.resolve();
}

async function windowCollection(): Promise<Collection<WindowDoc>> {
  const db = await connectToDatabase();
  return db.collection<WindowDoc>(COLLECTIONS.RATE_LIMITS);
}

async function throttleCollection(): Promise<Collection<ThrottleDoc>> {
  const db = await connectToDatabase();
  return db.collection<ThrottleDoc>(COLLECTIONS.AUTH_THROTTLE);
}

export interface WindowResult {
  /** true if the request is within the limit and may proceed */
  allowed: boolean;
  /** current count in this window (after incrementing) */
  count: number;
  limit: number;
  /** seconds until the current window resets */
  retryAfterSeconds: number;
}

/**
 * Atomically increments a fixed-window counter and reports whether the caller
 * is within `limit`. The window is bucketed by wall-clock time so all instances
 * agree on the same boundary without coordination.
 */
export async function incrementWindow(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<WindowResult> {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const docId = `${key}:${windowStart}`;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd - now) / 1000));

  try {
    void ensureIndexes();
    const col = await windowCollection();
    const doc = await col.findOneAndUpdate(
      { _id: docId },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(windowEnd) },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const count = doc?.count ?? 1;
    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfterSeconds,
    };
  } catch (err) {
    console.error('[rateLimit] incrementWindow failed (failing open):', err);
    return { allowed: true, count: 0, limit, retryAfterSeconds };
  }
}

export interface ThrottleState {
  /** true if the caller must wait before their next attempt */
  blocked: boolean;
  retryAfterSeconds: number;
  failures: number;
}

/**
 * Reads the current backoff state for an auth identity (IP or account) without
 * modifying it. Used as a pre-check before processing an auth attempt.
 */
export async function getThrottleState(key: string): Promise<ThrottleState> {
  try {
    const col = await throttleCollection();
    const doc = await col.findOne({ _id: key });
    if (!doc) return { blocked: false, retryAfterSeconds: 0, failures: 0 };

    const now = Date.now();
    const nextAllowed = doc.nextAllowedAt.getTime();
    if (nextAllowed > now) {
      return {
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((nextAllowed - now) / 1000)),
        failures: doc.failures,
      };
    }
    return { blocked: false, retryAfterSeconds: 0, failures: doc.failures };
  } catch (err) {
    console.error('[rateLimit] getThrottleState failed (failing open):', err);
    return { blocked: false, retryAfterSeconds: 0, failures: 0 };
  }
}

/**
 * Records a failed auth attempt and computes the next exponential-backoff delay.
 * Returns the resulting throttle state (so the caller can surface Retry-After).
 *
 * Delay formula once free attempts are exhausted:
 *   delay = min(baseMs * 2^(failures - freeAttempts - 1), maxMs)
 * This never becomes a permanent lockout — the delay is capped and the record
 * self-expires after `windowSeconds` of inactivity.
 */
export async function registerFailure(
  key: string,
  opts: {
    freeAttempts: number;
    backoffBaseMs: number;
    backoffMaxMs: number;
    windowSeconds: number;
  }
): Promise<ThrottleState> {
  try {
    void ensureIndexes();
    const col = await throttleCollection();
    const now = Date.now();

    const existing = await col.findOne({ _id: key });
    const failures = (existing?.failures ?? 0) + 1;

    let delayMs = 0;
    if (failures > opts.freeAttempts) {
      const exponent = failures - opts.freeAttempts - 1;
      delayMs = Math.min(opts.backoffBaseMs * 2 ** exponent, opts.backoffMaxMs);
    }

    const nextAllowedAt = new Date(now + delayMs);
    // Keep the record alive long enough to cover both the counting window and
    // the current backoff delay; inactivity beyond that resets the offender.
    const ttlMs = Math.max(opts.windowSeconds * 1000, delayMs) + 60_000;
    const expiresAt = new Date(now + ttlMs);

    await col.updateOne(
      { _id: key },
      {
        $set: {
          failures,
          lastFailureAt: new Date(now),
          nextAllowedAt,
          expiresAt,
        },
        $setOnInsert: { firstFailureAt: new Date(now) },
      },
      { upsert: true }
    );

    return {
      blocked: delayMs > 0,
      retryAfterSeconds: Math.max(0, Math.ceil(delayMs / 1000)),
      failures,
    };
  } catch (err) {
    console.error('[rateLimit] registerFailure failed:', err);
    return { blocked: false, retryAfterSeconds: 0, failures: 0 };
  }
}

/** Clears the backoff record for an identity after a successful auth. */
export async function clearFailures(key: string): Promise<void> {
  try {
    const col = await throttleCollection();
    await col.deleteOne({ _id: key });
  } catch (err) {
    console.error('[rateLimit] clearFailures failed:', err);
  }
}
