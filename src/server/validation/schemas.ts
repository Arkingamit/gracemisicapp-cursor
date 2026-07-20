import { ObjectId } from 'mongodb';
import { z } from 'zod';

/**
 * Reusable, strict zod primitives and domain schemas.
 * These are the single source of truth for input shapes across API routes.
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

/** A MongoDB ObjectId string (matches how the app stores/looks up IDs). */
export const objectId = z
  .string()
  .trim()
  .refine((v) => ObjectId.isValid(v), { message: 'must be a valid id' });

export const objectIdArray = z.array(objectId);

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: 'email is too short' })
  .max(254, { message: 'email is too long' })
  .email({ message: 'must be a valid email address' });

/** Login password: only presence/length is checked (never re-format a secret). */
export const loginPassword = z.string().min(1, { message: 'password is required' }).max(200);

/** A new password being set — enforce a minimum strength length. */
export const newPassword = z
  .string()
  .min(6, { message: 'must be at least 6 characters' })
  .max(200, { message: 'must be at most 200 characters' });

/** Non-empty, trimmed, length-bounded string. */
export const boundedString = (max: number, opts?: { min?: number }) =>
  z
    .string()
    .trim()
    .min(opts?.min ?? 1, { message: `must be at least ${opts?.min ?? 1} character(s)` })
    .max(max, { message: `must be at most ${max} characters` });

/** Optional string with an upper length bound (empty allowed). */
export const optionalBoundedString = (max: number) =>
  z.string().trim().max(max, { message: `must be at most ${max} characters` }).optional();

export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url({ message: 'must be a valid URL' });

// ─── Enums (aligned with src/lib/types.ts) ───────────────────────────────────

export const userRoleEnum = z.enum([
  'super_admin',
  'editor',
  'verifier',
  'manager',
  'user',
]);
export const orgRoleEnum = z.enum(['manager', 'editor', 'user']);
export const moderationStatusEnum = z.enum(['ok', 'flagged', 'restricted']);
export const songStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export const songFormatEnum = z.enum(['auto', 'chordpro']);
export const feedbackTypeEnum = z.enum(['question', 'bug', 'general', 'idea']);
export const feedbackStatusEnum = z.enum(['new', 'in-progress', 'resolved']);
export const songReportCategoryEnum = z.enum([
  'misplaced_chords',
  'incomplete_song',
  'wrong_metadata',
  'other',
]);
export const songReportStatusEnum = z.enum(['new', 'reviewed', 'dismissed']);
export const joinRequestDecisionEnum = z.enum(['approved', 'rejected']);
export const verifyDecisionEnum = z.enum(['approved', 'rejected']);
export const musicianStatsVisibilityEnum = z.enum(['all', 'editors', 'managers']);
export const devicePlatformEnum = z.enum(['android', 'ios']);

// ─── Field length caps (kept consistent with existing route checks) ──────────

export const SONG_TITLE_MAX = 50;
export const SONG_ARTIST_MAX = 30;
export const SONG_LANGUAGE_MAX = 20;
export const SONG_GENRE_ITEM_MAX = 20;
export const SONG_LYRICS_MAX = 20000;
export const NAME_MAX = 120;
export const MESSAGE_MAX = 5000;

// ─── Shared composite pieces ─────────────────────────────────────────────────

/**
 * Song genre may arrive as string[] or a comma-separated string; normalized to
 * a non-empty string[] with each entry length-bounded.
 */
export const genreInput = z
  .union([
    z.array(boundedString(SONG_GENRE_ITEM_MAX)).min(1, { message: 'at least one genre is required' }),
    boundedString(200),
  ])
  .transform((value) =>
    Array.isArray(value)
      ? value.map((g) => g.trim()).filter(Boolean)
      : value
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean)
  )
  .refine((arr) => arr.length > 0, { message: 'at least one genre is required' })
  .refine((arr) => arr.every((g) => g.length <= SONG_GENRE_ITEM_MAX), {
    message: `each genre must be at most ${SONG_GENRE_ITEM_MAX} characters`,
  });

export const songTransposition = z
  .object({
    songId: objectId,
    transposition: z.number().int().min(-24).max(24),
    useFlats: z.boolean().optional(),
  })
  .strict();

export const musicianAssignment = z
  .object({
    userId: objectId,
    instrument: boundedString(60),
    userName: z.string().max(120).nullish(),
  })
  .strict();

/** Per-song edit-state map: keyed by songId, opaque JSON value per key. */
export const songEditStates = z.record(z.string(), z.unknown());

// ─── Pagination ──────────────────────────────────────────────────────────────

export const pagination = (defaultLimit = 100, maxLimit = 5000) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });

// ─── System settings (super-admin editable) ─────────────────────────────────

const nullableCount = z.number().int().min(0).max(100_000_000).nullable();
const nullableMs = z.number().int().min(0).max(86_400_000).nullable();

/**
 * Strict schema for PATCH /api/settings and /api/admin/settings.
 * Enumerates every allowed SystemSettings field so unknown keys are rejected.
 */
export const systemSettingsUpdateSchema = z
  .object({
    allow_user_org_creation: z.boolean().optional(),
    enable_ai_chat: z.boolean().optional(),
    max_groups_per_user: nullableCount.optional(),
    max_custom_songs_per_org: nullableCount.optional(),
    global_ai_chat_limit_mb: z.number().min(0).max(1_000_000).optional(),
    max_songs_per_group: nullableCount.optional(),
    max_members_per_org: nullableCount.optional(),
    max_activity_logs: nullableCount.optional(),
    max_collections_per_user: nullableCount.optional(),
    max_songs_per_collection: nullableCount.optional(),
    max_song_submissions_per_day: nullableCount.optional(),
    spam_rejection_threshold: nullableCount.optional(),
    spam_song_report_threshold: nullableCount.optional(),
    spam_user_report_threshold: nullableCount.optional(),
    groq_api_key: z.string().max(500).optional(),
    ai_model: z.string().max(200).optional(),
    app_minimum_version: z.string().max(40).optional(),
    app_latest_version: z.string().max(40).optional(),
    app_update_url_android: z.string().max(2048).optional(),
    app_update_url_ios: z.string().max(2048).optional(),
    app_force_update_message: z.string().max(2000).optional(),
    rate_limit_enabled: z.boolean().optional(),
    rate_limit_auth_max_per_ip: nullableCount.optional(),
    rate_limit_auth_max_per_account: nullableCount.optional(),
    rate_limit_auth_window_seconds: nullableCount.optional(),
    rate_limit_auth_free_attempts: nullableCount.optional(),
    rate_limit_auth_backoff_base_ms: nullableMs.optional(),
    rate_limit_auth_backoff_max_ms: nullableMs.optional(),
    rate_limit_public_max: nullableCount.optional(),
    rate_limit_public_window_seconds: nullableCount.optional(),
    rate_limit_authenticated_max: nullableCount.optional(),
    rate_limit_authenticated_window_seconds: nullableCount.optional(),
    rate_limit_sensitive_max: nullableCount.optional(),
    rate_limit_sensitive_window_seconds: nullableCount.optional(),
  })
  .strict();
