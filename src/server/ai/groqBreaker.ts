import { getBreaker } from '@/server/circuitBreaker';

/**
 * Shared circuit breaker for the Groq API. All AI routes (chat, search,
 * duplicate check) go through this, so when Groq is down or slow the whole
 * app learns it once and fails fast instead of each request hanging.
 */
export function groqBreaker() {
  return getBreaker('groq', {
    // Chat completions normally finish in a few seconds; anything past 30s
    // means the dependency is unhealthy and the caller shouldn't keep waiting.
    timeoutMs: 30_000,
    // Bulkhead: don't let AI traffic consume every server connection.
    maxConcurrent: 10,
    failureThreshold: 5,
    openMs: 30_000,
    countsAsFailure: (error: unknown) => {
      // 4xx (bad request, invalid key, oversized prompt) are our fault, not
      // evidence that Groq is down — don't trip the circuit on them.
      // 429 (rate limit) and 5xx do count.
      const status = (error as { status?: number })?.status;
      if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
        return false;
      }
      return true;
    },
  });
}
