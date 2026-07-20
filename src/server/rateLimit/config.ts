import { appCache } from '../cache';
import { RATE_LIMIT_DEFAULTS, SettingsModel } from '../models/settings';

/**
 * Fully-resolved rate-limit configuration. Every field is a concrete number so
 * callers never have to deal with null/undefined. Resolution precedence is:
 *   1. RATE_LIMIT_* environment variable (operator override)
 *   2. settings document (super-admin editable)
 *   3. RATE_LIMIT_DEFAULTS (code default)
 */
export interface ResolvedRateLimitConfig {
  enabled: boolean;
  auth: {
    maxPerIp: number;
    maxPerAccount: number;
    windowSeconds: number;
    freeAttempts: number;
    backoffBaseMs: number;
    backoffMaxMs: number;
  };
  public: { max: number; windowSeconds: number };
  authenticated: { max: number; windowSeconds: number };
  sensitive: { max: number; windowSeconds: number };
}

const CONFIG_CACHE_KEY = 'ratelimit:config';
const CONFIG_TTL_SECONDS = 30;

function envNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function envBool(name: string): boolean | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  return raw === 'true' || raw === '1';
}

/**
 * Picks the first defined value: env override, then settings value, then default.
 * Treats null/undefined (but NOT 0) from settings as "unset".
 */
function pick(
  envVal: number | undefined,
  settingVal: number | null | undefined,
  fallback: number
): number {
  if (envVal !== undefined) return envVal;
  if (settingVal !== null && settingVal !== undefined) return settingVal;
  return fallback;
}

/**
 * Reads and resolves rate-limit config. Cached for a short TTL so we don't hit
 * MongoDB on every request. Fails open to defaults if settings are unavailable.
 */
export async function getRateLimitConfig(): Promise<ResolvedRateLimitConfig> {
  const cached = appCache.get<ResolvedRateLimitConfig>(CONFIG_CACHE_KEY);
  if (cached) return cached;

  let s: Awaited<ReturnType<typeof SettingsModel.getSettings>> | null = null;
  try {
    s = await SettingsModel.getSettings();
  } catch {
    s = null;
  }

  const d = RATE_LIMIT_DEFAULTS;
  const enabled =
    envBool('RATE_LIMIT_ENABLED') ??
    s?.rate_limit_enabled ??
    d.rate_limit_enabled;

  const config: ResolvedRateLimitConfig = {
    enabled,
    auth: {
      maxPerIp: pick(envNumber('RATE_LIMIT_AUTH_MAX_PER_IP'), s?.rate_limit_auth_max_per_ip, d.rate_limit_auth_max_per_ip),
      maxPerAccount: pick(envNumber('RATE_LIMIT_AUTH_MAX_PER_ACCOUNT'), s?.rate_limit_auth_max_per_account, d.rate_limit_auth_max_per_account),
      windowSeconds: pick(envNumber('RATE_LIMIT_AUTH_WINDOW_SECONDS'), s?.rate_limit_auth_window_seconds, d.rate_limit_auth_window_seconds),
      freeAttempts: pick(envNumber('RATE_LIMIT_AUTH_FREE_ATTEMPTS'), s?.rate_limit_auth_free_attempts, d.rate_limit_auth_free_attempts),
      backoffBaseMs: pick(envNumber('RATE_LIMIT_AUTH_BACKOFF_BASE_MS'), s?.rate_limit_auth_backoff_base_ms, d.rate_limit_auth_backoff_base_ms),
      backoffMaxMs: pick(envNumber('RATE_LIMIT_AUTH_BACKOFF_MAX_MS'), s?.rate_limit_auth_backoff_max_ms, d.rate_limit_auth_backoff_max_ms),
    },
    public: {
      max: pick(envNumber('RATE_LIMIT_PUBLIC_MAX'), s?.rate_limit_public_max, d.rate_limit_public_max),
      windowSeconds: pick(envNumber('RATE_LIMIT_PUBLIC_WINDOW_SECONDS'), s?.rate_limit_public_window_seconds, d.rate_limit_public_window_seconds),
    },
    authenticated: {
      max: pick(envNumber('RATE_LIMIT_AUTHENTICATED_MAX'), s?.rate_limit_authenticated_max, d.rate_limit_authenticated_max),
      windowSeconds: pick(envNumber('RATE_LIMIT_AUTHENTICATED_WINDOW_SECONDS'), s?.rate_limit_authenticated_window_seconds, d.rate_limit_authenticated_window_seconds),
    },
    sensitive: {
      max: pick(envNumber('RATE_LIMIT_SENSITIVE_MAX'), s?.rate_limit_sensitive_max, d.rate_limit_sensitive_max),
      windowSeconds: pick(envNumber('RATE_LIMIT_SENSITIVE_WINDOW_SECONDS'), s?.rate_limit_sensitive_window_seconds, d.rate_limit_sensitive_window_seconds),
    },
  };

  appCache.set(CONFIG_CACHE_KEY, config, CONFIG_TTL_SECONDS);
  return config;
}

/** Clears the cached config (call after settings are updated). */
export function invalidateRateLimitConfig(): void {
  appCache.invalidate(CONFIG_CACHE_KEY);
}
