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
  groq_api_key?: string;
  ai_model?: string;
  // App version control (force update mechanism)
  app_minimum_version?: string;
  app_latest_version?: string;
  app_update_url_android?: string;
  app_update_url_ios?: string;
  app_force_update_message?: string;
}

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
          groq_api_key: '',
          ai_model: 'llama-3.3-70b-versatile',
          app_minimum_version: '0.1.0',
          app_latest_version: '0.1.0',
          app_update_url_android: '',
          app_update_url_ios: '',
          app_force_update_message: 'A critical update is required to continue using Grace Music. Please update to the latest version.'
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
        groq_api_key: settings.groq_api_key ?? '',
        ai_model: settings.ai_model || 'llama-3.3-70b-versatile',
        app_minimum_version: settings.app_minimum_version ?? '0.1.0',
        app_latest_version: settings.app_latest_version ?? '0.1.0',
        app_update_url_android: settings.app_update_url_android ?? '',
        app_update_url_ios: settings.app_update_url_ios ?? '',
        app_force_update_message: settings.app_force_update_message ?? 'A critical update is required to continue using Grace Music. Please update to the latest version.'
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
        groq_api_key: '',
        ai_model: 'llama-3.3-70b-versatile',
        app_minimum_version: '0.1.0',
        app_latest_version: '0.1.0',
        app_update_url_android: '',
        app_update_url_ios: '',
        app_force_update_message: 'A critical update is required to continue using Grace Music. Please update to the latest version.'
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
