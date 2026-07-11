import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { authFetch } from '@/contexts/AuthContext';

/**
 * Initialize native push notifications for Capacitor (Android/iOS).
 * This should only be called once when the user is authenticated.
 * On web, this is a no-op — web push is handled separately via Service Workers.
 */
export async function initNativePushNotifications(): Promise<void> {
  // Only run on native platforms (Android/iOS)
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Check current permission status
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      // Request permission from the user
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    // Register with the OS push service (FCM for Android, APNs for iOS)
    await PushNotifications.register();

    // Listen for successful registration — send the token to our server
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration token:', token.value);

      try {
        await authFetch('/api/notifications/register-device', {
          method: 'POST',
          body: JSON.stringify({
            token: token.value,
            platform: Capacitor.getPlatform(), // 'android' or 'ios'
          }),
        });
        console.log('Device token registered with server');
      } catch (error) {
        console.error('Failed to register device token with server:', error);
      }
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Listen for push notifications received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received in foreground:', notification);
      // The notification is shown automatically by the OS on Android.
      // On iOS, the presentationOptions in capacitor.config.ts controls this.
    });

    // Listen for notification tap (user tapped the notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push notification action performed:', action);
      const data = action.notification.data;

      // Navigate to the link if provided
      if (data?.link && typeof data.link === 'string') {
        // Use window.location for navigation since we're in a webview
        window.location.href = data.link;
      }
    });
  } catch (error) {
    console.error('Error initializing native push notifications:', error);
  }
}

/**
 * Remove all push notification listeners.
 * Call this on logout to clean up.
 */
export async function removeNativePushListeners(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error('Error removing push notification listeners:', error);
  }
}
