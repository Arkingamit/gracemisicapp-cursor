import webpush from 'web-push';
import { PushSubscriptionModel } from '../models/pushSubscription';
import { NotificationModel } from '../models/notification';
import { DeviceTokenModel } from '../models/deviceToken';
import { getApps, getMessaging } from './firebaseAdmin';
import { getBreaker, isBreakerError } from '@/server/circuitBreaker';

// Push delivery is best-effort: the in-app notification is already stored in
// the DB, so when a push provider degrades we fast-fail deliveries (fallback:
// user sees the notification in-app) rather than letting every request that
// triggers a notification hang on a sick provider.
const webPushBreaker = () =>
  getBreaker('web-push', {
    timeoutMs: 10_000,
    maxConcurrent: 25,
    failureThreshold: 8,
    openMs: 60_000,
    // 404/410 mean the individual subscription is gone (client-side issue),
    // not that the push service is unhealthy.
    countsAsFailure: (error: unknown) => {
      const status = (error as { statusCode?: number })?.statusCode;
      return status !== 404 && status !== 410;
    },
  });

const fcmBreaker = () =>
  getBreaker('fcm', {
    timeoutMs: 10_000,
    maxConcurrent: 25,
    failureThreshold: 8,
    openMs: 60_000,
    // Invalid/unregistered tokens are per-device cleanup, not an FCM outage.
    countsAsFailure: (error: unknown) => {
      const code = (error as { code?: string })?.code || '';
      return (
        code !== 'messaging/registration-token-not-registered' &&
        code !== 'messaging/invalid-registration-token'
      );
    },
  });

// Configure web-push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:gamitarkin2@gmail.com', // Replace with admin email
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendNotificationToUser(
  userId: string,
  title: string,
  message: string,
  link: string = '/'
) {
  // 1. Create in-app notification record
  await NotificationModel.create(userId, title, message, link);

  // 2 & 3. Web push + FCM
  await pushToUser(userId, title, message, link);
}

/**
 * Notify many users with the same message. The in-app notification records
 * are written with a single insertMany (one round trip instead of one per
 * user); the external push deliveries then run concurrently.
 */
export async function sendNotificationToUsers(
  userIds: string[],
  title: string,
  message: string,
  link: string = '/'
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  await NotificationModel.createMany(unique, title, message, link);
  await Promise.all(unique.map((userId) => pushToUser(userId, title, message, link)));
}

/** Delivers web push + FCM to one user (no DB notification write). */
async function pushToUser(
  userId: string,
  title: string,
  message: string,
  link: string = '/'
) {
  // Send Web Push to all active subscriptions
  try {
    const subscriptions = await PushSubscriptionModel.findByUserId(userId);
    
    if (subscriptions.length > 0) {
      const payload = JSON.stringify({
        title,
        body: message,
        link,
        icon: '/icon-192x192.png' // Default icon
      });

      // Send to all endpoints, if any fail with 410 (Gone), we remove them
      const sendPromises = subscriptions.map(async (sub) => {
        try {
          await webPushBreaker().exec(() => webpush.sendNotification(sub, payload));
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription is no longer valid, remove it
            await PushSubscriptionModel.removeByEndpoint(sub.endpoint);
          } else if (isBreakerError(error)) {
            // Provider degraded — skip delivery; in-app notification suffices.
          } else {
            console.error('Error sending push notification to endpoint:', sub.endpoint, error);
          }
        }
      });

      await Promise.all(sendPromises);
    }
  } catch (error) {
    console.error('Error in web push sendNotificationToUser:', error);
  }

  // 3. Send FCM push to all registered mobile devices
  try {
    // Only attempt FCM if Firebase Admin SDK is initialized
    if (getApps().length > 0) {
      const deviceTokens = await DeviceTokenModel.findByUserId(userId);

      if (deviceTokens.length > 0) {
        const sendPromises = deviceTokens.map(async (dt) => {
          try {
            await fcmBreaker().exec(() => getMessaging().send({
              token: dt.token,
              notification: {
                title,
                body: message,
              },
              data: {
                link,
                title,
                body: message,
              },
              // Android-specific config
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  clickAction: 'FCM_PLUGIN_ACTIVITY',
                },
              },
              // APNs (iOS) specific config
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1,
                  },
                },
              },
            }));
          } catch (error: any) {
            // Token is no longer valid — remove it
            if (
              error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token'
            ) {
              await DeviceTokenModel.removeByToken(dt.token);
              console.log(`Removed invalid FCM token for user ${userId}`);
            } else if (isBreakerError(error)) {
              // FCM degraded — skip delivery; in-app notification suffices.
            } else {
              console.error('Error sending FCM notification:', error);
            }
          }
        });

        await Promise.all(sendPromises);
      }
    }
  } catch (error) {
    console.error('Error in FCM sendNotificationToUser:', error);
  }
}
