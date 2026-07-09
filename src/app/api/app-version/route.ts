import { SettingsModel } from '@/server/models/settings';

// Public endpoint — no auth required
// Mobile apps call this on launch to check if an update is needed
export async function GET() {
  try {
    const settings = await SettingsModel.getSettings();
    
    return Response.json({
      minimum_version: settings.app_minimum_version || '0.1.0',
      latest_version: settings.app_latest_version || '0.1.0',
      update_url_android: settings.app_update_url_android || '',
      update_url_ios: settings.app_update_url_ios || '',
      force_update_message: settings.app_force_update_message || 'A critical update is required. Please update to the latest version.',
    });
  } catch (error) {
    console.error('App version check error:', error);
    // On error, don't block the user — return safe defaults
    return Response.json({
      minimum_version: '0.0.0',
      latest_version: '0.0.0',
      update_url_android: '',
      update_url_ios: '',
      force_update_message: '',
    });
  }
}

