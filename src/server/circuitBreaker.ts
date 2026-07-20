/**
 * Circuit breaker + bulkhead for external dependencies (Groq, web push, FCM).
 *
 * Protects the app from a slow or failing dependency cascading into exhausted
 * connections/event-loop backlog while every request waits on it:
 *
 * - Timeout: each call gets a hard deadline; a hung dependency fails fast.
 * - Bulkhead: at most `maxConcurrent` in-flight calls per dependency; excess
 *   callers are rejected immediately instead of piling up.
 * - Breaker: after `failureThreshold` consecutive failures the circuit opens
 *   and calls fail instantly for `openMs`. Then one half-open probe is let
 *   through; success closes the circuit, failure re-opens it.
 *
 * Callers catch `CircuitOpenError` / `BreakerBusyError` / `BreakerTimeoutError`
 * to serve a fallback (e.g. 503 for AI, skip-push for notifications).
 */

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit for "${name}" is open (dependency failing); failing fast.`);
    this.name = 'CircuitOpenError';
  }
}

export class BreakerBusyError extends Error {
  constructor(name: string, limit: number) {
    super(`Too many concurrent calls to "${name}" (limit ${limit}); rejecting.`);
    this.name = 'BreakerBusyError';
  }
}

export class BreakerTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`Call to "${name}" timed out after ${timeoutMs}ms.`);
    this.name = 'BreakerTimeoutError';
  }
}

export interface BreakerOptions {
  /** Per-call timeout. A timeout counts as a failure. */
  timeoutMs: number;
  /** Max in-flight calls to this dependency (bulkhead). */
  maxConcurrent: number;
  /** Consecutive failures that trip the circuit. */
  failureThreshold: number;
  /** How long the circuit stays open before a half-open probe. */
  openMs: number;
  /**
   * Optional classifier: return false for errors that should NOT count toward
   * tripping (e.g. an expired push subscription is the client's fault, not a
   * sign the push service is down). Defaults to counting everything.
   */
  countsAsFailure?: (error: unknown) => boolean;
}

type BreakerState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private active = 0;
  private probeInFlight = false;

  constructor(
    private readonly name: string,
    private readonly opts: BreakerOptions
  ) {}

  getState(): BreakerState {
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.opts.openMs) {
        throw new CircuitOpenError(this.name);
      }
      // Cool-down elapsed: allow exactly one probe through.
      if (this.probeInFlight) {
        throw new CircuitOpenError(this.name);
      }
      this.state = 'half-open';
      this.probeInFlight = true;
    } else if (this.state === 'half-open' && this.probeInFlight) {
      throw new CircuitOpenError(this.name);
    }

    if (this.active >= this.opts.maxConcurrent) {
      if (this.state === 'half-open') this.probeInFlight = false;
      throw new BreakerBusyError(this.name, this.opts.maxConcurrent);
    }

    this.active++;
    try {
      const result = await this.withTimeout(fn());
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    } finally {
      this.active--;
      this.probeInFlight = false;
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new BreakerTimeoutError(this.name, this.opts.timeoutMs)),
        this.opts.timeoutMs
      );
      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
    });
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== 'closed') {
      console.info(`[breaker:${this.name}] recovered — circuit closed`);
    }
    this.state = 'closed';
  }

  private onFailure(error: unknown): void {
    // Fast-fail/bulkhead rejections aren't evidence about dependency health.
    if (error instanceof CircuitOpenError || error instanceof BreakerBusyError) {
      return;
    }
    const counts = this.opts.countsAsFailure?.(error) ?? true;
    if (!counts) return;

    this.consecutiveFailures++;
    if (
      this.state === 'half-open' ||
      this.consecutiveFailures >= this.opts.failureThreshold
    ) {
      if (this.state !== 'open') {
        console.warn(
          `[breaker:${this.name}] circuit OPEN after ${this.consecutiveFailures} consecutive failure(s)`
        );
      }
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }
}

// Registry survives dev HMR reloads, mirroring the appCache pattern.
const globalWithBreakers = global as typeof globalThis & {
  _circuitBreakers?: Map<string, CircuitBreaker>;
};
if (!globalWithBreakers._circuitBreakers) {
  globalWithBreakers._circuitBreakers = new Map();
}
const registry = globalWithBreakers._circuitBreakers;

export function getBreaker(name: string, opts: BreakerOptions): CircuitBreaker {
  let breaker = registry.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, opts);
    registry.set(name, breaker);
  }
  return breaker;
}

/** True when the error is a breaker rejection (open/busy/timeout). */
export function isBreakerError(error: unknown): boolean {
  return (
    error instanceof CircuitOpenError ||
    error instanceof BreakerBusyError ||
    error instanceof BreakerTimeoutError
  );
}
