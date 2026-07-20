import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { authFetch } from '@/contexts/AuthContext';

export type NativePushPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

interface GraceAppPlugin {
  openNotificationSettings(): Promise<void>;
  getAppInfo(): Promise<{ packageName: string; appName: string }>;
}

const GraceApp = registerPlugin<GraceAppPlugin>('GraceApp');

let listenersAttached = false;

export async function getNativePushPermission(): Promise<NativePushPermission> {
  if (!Capacitor.isNativePlatform()) return 'unknown';
  try {
    const status = await PushNotifications.checkPermissions();
    if (status.receive === 'granted') return 'granted';
    if (status.receive === 'denied') return 'denied';
    if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
      return 'prompt';
    }
    return 'unknown';
  } catch (error) {
    console.error('Failed to check native push permission:', error);
    return 'unknown';
  }
}

export async function openNativeNotificationSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await GraceApp.openNotificationSettings();
  } catch (error) {
    console.error('Failed to open notification settings:', error);
  }
}

/**
 * Initialize native push notifications for Capacitor (Android/iOS).
 * Only call when the user is authenticated.
 * On web this is a no-op — web push uses Service Workers separately.
 *
 * Pass userInitiated=true to show the system permission dialog when needed.
 */
export async function initNativePushNotifications(
  userInitiated = false
): Promise<'requires_prompt' | 'granted' | 'denied'> {
  if (!Capacitor.isNativePlatform()) return 'denied';

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      if (!userInitiated) {
        return 'requires_prompt';
      }
      // Shows the Android 13+ system dialog: "Allow Grace Music to send you notifications?"
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission not granted:', permStatus.receive);
      return 'denied';
    }

    // Ensure a notification channel exists on Android 8+
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'default',
          name: 'Grace Music',
          description: 'Song sets, groups, and app updates',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        });
      } catch (channelError) {
        // Channel may already exist
        console.warn('Push channel setup:', channelError);
      }
    }

    // Attach listeners before register() so we never miss the token callback
    if (!listenersAttached) {
      listenersAttached = true;

      await PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration token:', token.value);
        try {
          await authFetch('/api/notifications/register-device', {
            method: 'POST',
            body: JSON.stringify({
              token: token.value,
              platform: Capacitor.getPlatform(),
            }),
          });
          console.log('Device token registered with server');
        } catch (error) {
          console.error('Failed to register device token with server:', error);
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', JSON.stringify(error));
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received in foreground:', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action performed:', action);
        const data = action.notification.data;
        if (data?.link && typeof data.link === 'string') {
          window.location.href = data.link;
        }
      });
    }

    await PushNotifications.register();
    return 'granted';
  } catch (error) {
    console.error('Error initializing native push notifications:', error);
    return 'denied';
  }
}

/**
 * Remove push notification listeners (e.g. on logout).
 */
export async function removeNativePushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.removeAllListeners();
    listenersAttached = false;
  } catch (error) {
    console.error('Error removing push notification listeners:', error);
  }
}
