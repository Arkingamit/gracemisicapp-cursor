import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

export interface SystemSettings {
  allow_user_org_creation: boolean;
  enable_ai_chat: boolean;
  max_groups_per_user?: number | null;
  max_custom_songs_per_org?: number | null;
  global_ai_chat_limit_mb: number;
  max_songs_per_group?: number | null;
  max_members_per_org?: number | null;
  max_activity_logs?: number | null;
  max_collections_per_user?: number | null;
  max_songs_per_collection?: number | null;
  /** Max global song submissions per user per day (null = unlimited) */
  max_song_submissions_per_day?: number | null;
  /** Rejected songs before auto-restricting the contributor (null = disabled) */
  spam_rejection_threshold?: number | null;
  /** Unique song reports against a contributor before auto-flag (null = disabled) */
  spam_song_report_threshold?: number | null;
  /** Verifier spam reports against a user before auto-restrict (null = disabled) */
  spam_user_report_threshold?: number | null;
  groq_api_key?: string;
  ai_model?: string;
  // App version control (force update mechanism)
  app_minimum_version?: string;
  app_latest_version?: string;
  app_update_url_android?: string;
  app_update_url_ios?: string;
  app_force_update_message?: string;

  // ─── Rate limiting (all thresholds configurable; 0 or null disables that dimension) ───
  /** Master switch for HTTP rate limiting */
  rate_limit_enabled?: boolean;

  // Authentication routes (login/register/password) — strict
  /** Max auth attempts per IP within the auth window */
  rate_limit_auth_max_per_ip?: number | null;
  /** Max auth attempts per account (email) within the auth window */
  rate_limit_auth_max_per_account?: number | null;
  /** Sliding window (seconds) for auth attempt counting */
  rate_limit_auth_window_seconds?: number | null;
  /** Failed attempts allowed before exponential backoff engages */
  rate_limit_auth_free_attempts?: number | null;
  /** Base delay (ms) for exponential backoff after free attempts are used */
  rate_limit_auth_backoff_base_ms?: number | null;
  /** Maximum backoff delay (ms) — caps the exponential growth (no hard lockout) */
  rate_limit_auth_backoff_max_ms?: number | null;

  // Public / unauthenticated endpoints — moderate
  rate_limit_public_max?: number | null;
  rate_limit_public_window_seconds?: number | null;

  // Authenticated user actions — loose
  rate_limit_authenticated_max?: number | null;
  rate_limit_authenticated_window_seconds?: number | null;

  // Sensitive authenticated actions (e.g. AI chat) — tighter than general authenticated
  rate_limit_sensitive_max?: number | null;
  rate_limit_sensitive_window_seconds?: number | null;
}

/**
 * Default rate-limit thresholds. Every value is overridable via the settings
 * document (super-admin editable) or the corresponding RATE_LIMIT_* env var.
 * These are intentionally conservative-but-usable defaults, not hard limits.
 */
export const RATE_LIMIT_DEFAULTS = {
  rate_limit_enabled: true,
  // Auth: strict, IP + account, exponential backoff (no hard lockout)
  rate_limit_auth_max_per_ip: 30,
  rate_limit_auth_max_per_account: 12,
  rate_limit_auth_window_seconds: 900, // 15 min
  rate_limit_auth_free_attempts: 3,
  rate_limit_auth_backoff_base_ms: 1000, // 1s, doubling per failure
  rate_limit_auth_backoff_max_ms: 300000, // cap at 5 min
  // Public: moderate
  rate_limit_public_max: 120,
  rate_limit_public_window_seconds: 60,
  // Authenticated actions: loose
  rate_limit_authenticated_max: 300,
  rate_limit_authenticated_window_seconds: 60,
  // Sensitive authenticated actions (AI): tighter
  rate_limit_sensitive_max: 20,
  rate_limit_sensitive_window_seconds: 60,
} as const;

export class SettingsModel {
  private static readonly SETTINGS_DOC_ID = 'global_settings';

  static async getSettings(): Promise<SystemSettings> {
    try {
      const collection = await getCollection(COLLECTIONS.SETTINGS);
      const settings = await collection.findOne({ _id: this.SETTINGS_DOC_ID as any });
      
      if (!settings) {
        // Default settings
        const defaultSettings: SystemSettings = {
          allow_user_org_creation: true,
          enable_ai_chat: true,
          max_groups_per_user: null,
          max_custom_songs_per_org: null,
          global_ai_chat_limit_mb: 2,
          max_songs_per_group: null,
          max_members_per_org: null,
          max_activity_logs: 1000,
          max_collections_per_user: 20,
          max_songs_per_collection: 50,
          max_song_submissions_per_day: 10,
          spam_rejection_threshold: 5,
          spam_song_report_threshold: 5,
          spam_user_report_threshold: 3,
          groq_api_key: '',
          ai_model: 'openai/gpt-oss-20b',
          app_minimum_version: '0.1.0',
          app_latest_version: '0.1.0',
          app_update_url_android: '',
          app_update_url_ios: '',
          app_force_update_message: 'A critical update is required to continue using Grace Music. Please update to the latest version.',
          ...RATE_LIMIT_DEFAULTS,
        };
        await collection.insertOne({ _id: this.SETTINGS_DOC_ID as any, ...defaultSettings });
        return defaultSettings;
      }

      return {
        allow_user_org_creation: settings.allow_user_org_creation ?? true,
        enable_ai_chat: settings.enable_ai_chat ?? true,
        max_groups_per_user: settings.max_groups_per_user ?? null,
        max_custom_songs_per_org: settings.max_custom_songs_per_org ?? null,
        global_ai_chat_limit_mb: settings.global_ai_chat_limit_mb ?? 2,
        max_songs_per_group: settings.max_songs_per_group ?? null,
        max_members_per_org: settings.max_members_per_org ?? null,
        max_activity_logs: settings.max_activity_logs ?? 1000,
        max_collections_per_user: settings.max_collections_per_user ?? null,
        max_songs_per_collection: settings.max_songs_per_collection ?? null,
        max_song_submissions_per_day: settings.max_song_submissions_per_day ?? 10,
        spam_rejection_threshold: settings.spam_rejection_threshold ?? 5,
        spam_song_report_threshold: settings.spam_song_report_threshold ?? 5,
        spam_user_report_threshold: settings.spam_user_report_threshold ?? 3,
        groq_api_key: settings.groq_api_key ?? '',
        ai_model: settings.ai_model || 'openai/gpt-oss-20b',
        app_minimum_version: settings.app_minimum_version ?? '0.1.0',
        app_latest_version: settings.app_latest_version ?? '0.1.0',
        app_update_url_android: settings.app_update_url_android ?? '',
        app_update_url_ios: settings.app_update_url_ios ?? '',
        app_force_update_message: settings.app_force_update_message ?? 'A critical update is required to continue using Grace Music. Please update to the latest version.',
        rate_limit_enabled: settings.rate_limit_enabled ?? RATE_LIMIT_DEFAULTS.rate_limit_enabled,
        rate_limit_auth_max_per_ip: settings.rate_limit_auth_max_per_ip ?? RATE_LIMIT_DEFAULTS.rate_limit_auth_max_per_ip,
        rate_limit_auth_max_per_account: settings.rate_limit_auth_max_per_account ?? RATE_LIMIT_DEFAULTS.rate_limit_auth_max_per_account,
        rate_limit_auth_window_seconds: settings.rate_limit_auth_window_seconds ?? RATE_LIMIT_DEFAULTS.rate_limit_auth_window_seconds,
        rate_limit_auth_free_attempts: settings.rate_limit_auth_free_attempts ?? RATE_LIMIT_DEFAULTS.rate_limit_auth_free_attempts,
        rate_limit_auth_backoff_base_ms: settings.rate_limit_auth_backoff_base_ms ?? RATE_LIMIT_DEFAULTS.rate_limit_auth_backoff_base_ms,
        rate_limit_auth_backoff_max_ms: settings.rate_limit_auth_backoff_max_ms ?? RATE_LIMIT_DEFAULTS.rate_limit_auth_backoff_max_ms,
        rate_limit_public_max: settings.rate_limit_public_max ?? RATE_LIMIT_DEFAULTS.rate_limit_public_max,
        rate_limit_public_window_seconds: settings.rate_limit_public_window_seconds ?? RATE_LIMIT_DEFAULTS.rate_limit_public_window_seconds,
        rate_limit_authenticated_max: settings.rate_limit_authenticated_max ?? RATE_LIMIT_DEFAULTS.rate_limit_authenticated_max,
        rate_limit_authenticated_window_seconds: settings.rate_limit_authenticated_window_seconds ?? RATE_LIMIT_DEFAULTS.rate_limit_authenticated_window_seconds,
        rate_limit_sensitive_max: settings.rate_limit_sensitive_max ?? RATE_LIMIT_DEFAULTS.rate_limit_sensitive_max,
        rate_limit_sensitive_window_seconds: settings.rate_limit_sensitive_window_seconds ?? RATE_LIMIT_DEFAULTS.rate_limit_sensitive_window_seconds,
      };
    } catch (error) {
      console.error("Error fetching system settings:", error);
      return { 
        allow_user_org_creation: true,
        enable_ai_chat: true,
        max_groups_per_user: null,
        max_custom_songs_per_org: null,
        global_ai_chat_limit_mb: 2,
        max_songs_per_group: null,
        max_members_per_org: null,
        max_activity_logs: 1000,
        max_collections_per_user: null,
        max_songs_per_collection: null,
        max_song_submissions_per_day: 10,
        spam_rejection_threshold: 5,
        spam_song_report_threshold: 5,
        spam_user_report_threshold: 3,
        groq_api_key: '',
        ai_model: 'openai/gpt-oss-20b',
        app_minimum_version: '0.1.0',
        app_latest_version: '0.1.0',
        app_update_url_android: '',
        app_update_url_ios: '',
        app_force_update_message: 'A critical update is required to continue using Grace Music. Please update to the latest version.',
        ...RATE_LIMIT_DEFAULTS,
      }; // Safe fallback
    }
  }

  static async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      const collection = await getCollection(COLLECTIONS.SETTINGS);
      await collection.updateOne(
        { _id: this.SETTINGS_DOC_ID as any },
        { $set: updates },
        { upsert: true }
      );
      return this.getSettings();
    } catch (error) {
      console.error("Error updating system settings:", error);
      throw error;
    }
  }
}
