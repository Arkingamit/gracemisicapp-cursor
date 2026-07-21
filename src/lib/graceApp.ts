import { Capacitor, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';

interface GraceAppPlugin {
  openNotificationSettings(): Promise<void>;
  getAppInfo(): Promise<{ packageName: string; appName: string }>;
  /** Android: PDF viewers first, then share targets. */
  openPdf(options: { path?: string; uri?: string; title?: string }): Promise<void>;
}

const GraceApp = registerPlugin<GraceAppPlugin>('GraceApp');

/**
 * Open an exported PDF on native: prefer PDF viewers, then other apps.
 * Falls back to Capacitor Share when the native helper is unavailable.
 */
export async function openExportedPdf(options: {
  path: string;
  uri: string;
  title?: string;
}): Promise<void> {
  const title = options.title || options.path;

  if (Capacitor.getPlatform() === 'android') {
    try {
      await GraceApp.openPdf({
        path: options.path,
        uri: options.uri,
        title,
      });
      return;
    } catch (e) {
      console.warn('[Grace] openPdf failed, falling back to Share', e);
    }
  }

  await Share.share({
    title,
    url: options.uri,
    dialogTitle: 'Open or share PDF',
  });
}
