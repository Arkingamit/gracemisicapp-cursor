import type { NextRequest } from 'next/server';
import { getRateLimitConfig } from './config';
import {
  clearFailures,
  getThrottleState,
  incrementWindow,
  registerFailure,
} from './store';

export { getRateLimitConfig, invalidateRateLimitConfig } from './config';

/**
 * Extracts the client IP for rate-limit keying. On Vercel/most proxies the real
 * client is the first entry of `x-forwarded-for`. Falls back through common
 * proxy headers, then to a constant so keying still works (all unknowns share a
 * bucket — acceptable, they're already anomalous).
 */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Builds a 429 response with a `Retry-After` header (seconds) and a friendly,
 * consistent JSON body matching the app's `{ error }` convention.
 */
export function rateLimitResponse(
  retryAfterSeconds: number,
  message?: string
): Response {
  const retry = Math.max(1, Math.ceil(retryAfterSeconds));
  return new Response(
    JSON.stringify({
      error:
        message ??
        `Too many requests. Please wait ${retry} second${retry === 1 ? '' : 's'} and try again.`,
      retryAfter: retry,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retry),
      },
    }
  );
}

export type RateLimitPolicy = 'public' | 'authenticated' | 'sensitive';

interface EnforceOptions {
  /** Which configured limit tier to apply */
  policy: RateLimitPolicy;
  /**
   * Namespace so different endpoints get independent counters
   * (e.g. 'ai-chat', 'favorites'). Defaults to the request path.
   */
  bucket?: string;
  /**
   * Identity to key on. For authenticated tiers pass the userId; if omitted we
   * fall back to the client IP. Public tier always keys on IP.
   */
  identifier?: string;
}

/**
 * Enforces a fixed-window limit for public / authenticated / sensitive traffic.
 * Returns a 429 `Response` when the limit is exceeded, or `null` to proceed.
 * Fails open (returns null) if rate limiting is disabled or the store errors.
 */
export async function enforceRateLimit(
  request: NextRequest,
  options: EnforceOptions
): Promise<Response | null> {
  const config = await getRateLimitConfig();
  if (!config.enabled) return null;

  const tier = config[options.policy];
  if (!tier || tier.max <= 0) return null; // 0 / disabled = unlimited

  const bucket = options.bucket ?? new URL(request.url).pathname;
  const identity =
    options.policy === 'public'
      ? getClientIp(request)
      : options.identifier || getClientIp(request);

  const key = `${options.policy}:${bucket}:${identity}`;
  const result = await incrementWindow(key, tier.max, tier.windowSeconds);

  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSeconds);
  }
  return null;
}

const AUTH_BUCKET = 'auth';
const normalizeAccount = (account?: string | null) =>
  account ? account.trim().toLowerCase() : null;

/**
 * Strict pre-check for authentication routes. Combines:
 *   - per-IP attempt window
 *   - per-account attempt window
 *   - exponential-backoff state for both IP and account
 *
 * Call this BEFORE verifying credentials. Returns a 429 `Response` if the
 * caller is currently throttled/over the limit, otherwise `null`.
 */
export async function checkAuthRateLimit(
  request: NextRequest,
  account?: string | null
): Promise<Response | null> {
  const config = await getRateLimitConfig();
  if (!config.enabled) return null;

  const ip = getClientIp(request);
  const acct = normalizeAccount(account);
  const ipKey = `${AUTH_BUCKET}:ip:${ip}`;
  const acctKey = acct ? `${AUTH_BUCKET}:acct:${acct}` : null;

  // 1. Exponential backoff — if either identity is in a cooldown, reject early.
  const [ipThrottle, acctThrottle] = await Promise.all([
    getThrottleState(ipKey),
    acctKey ? getThrottleState(acctKey) : Promise.resolve(null),
  ]);
  const backoffWait = Math.max(
    ipThrottle.blocked ? ipThrottle.retryAfterSeconds : 0,
    acctThrottle?.blocked ? acctThrottle.retryAfterSeconds : 0
  );
  if (backoffWait > 0) {
    return rateLimitResponse(
      backoffWait,
      `Too many attempts. Please wait ${backoffWait} second${backoffWait === 1 ? '' : 's'} before trying again.`
    );
  }

  // 2. Fixed-window attempt caps (per IP and per account).
  const checks: Promise<{ allowed: boolean; retryAfterSeconds: number }>[] = [];
  if (config.auth.maxPerIp > 0) {
    checks.push(
      incrementWindow(ipKey, config.auth.maxPerIp, config.auth.windowSeconds)
    );
  }
  if (acctKey && config.auth.maxPerAccount > 0) {
    checks.push(
      incrementWindow(
        acctKey,
        config.auth.maxPerAccount,
        config.auth.windowSeconds
      )
    );
  }

  const results = await Promise.all(checks);
  const exceeded = results.find((r) => !r.allowed);
  if (exceeded) {
    return rateLimitResponse(exceeded.retryAfterSeconds);
  }

  return null;
}

/**
 * Records a failed authentication attempt against both the IP and the account,
 * advancing their exponential-backoff cooldowns. Call after credentials fail.
 */
export async function recordAuthFailure(
  request: NextRequest,
  account?: string | null
): Promise<void> {
  const config = await getRateLimitConfig();
  if (!config.enabled) return;

  const ip = getClientIp(request);
  const acct = normalizeAccount(account);
  const opts = {
    freeAttempts: config.auth.freeAttempts,
    backoffBaseMs: config.auth.backoffBaseMs,
    backoffMaxMs: config.auth.backoffMaxMs,
    windowSeconds: config.auth.windowSeconds,
  };

  await Promise.all([
    registerFailure(`${AUTH_BUCKET}:ip:${ip}`, opts),
    acct ? registerFailure(`${AUTH_BUCKET}:acct:${acct}`, opts) : Promise.resolve(),
  ]);
}

/**
 * Clears the account's backoff cooldown after a successful login so a
 * legitimate user is not penalized going forward. The IP record is left to
 * expire naturally (a single valid login shouldn't absolve a noisy IP).
 */
export async function recordAuthSuccess(account?: string | null): Promise<void> {
  const acct = normalizeAccount(account);
  if (!acct) return;
  await clearFailures(`${AUTH_BUCKET}:acct:${acct}`);
}
