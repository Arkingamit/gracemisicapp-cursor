import webpush from 'web-push';
import { PushSubscriptionModel } from '../models/pushSubscription';
import { NotificationModel } from '../models/notification';
import { DeviceTokenModel } from '../models/deviceToken';
import { getApps, getMessaging } from './firebaseAdmin';

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

  // 2. Send Web Push to all active subscriptions
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
          await webpush.sendNotification(sub, payload);
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription is no longer valid, remove it
            await PushSubscriptionModel.removeByEndpoint(sub.endpoint);
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
            await getMessaging().send({
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
            });
          } catch (error: any) {
            // Token is no longer valid — remove it
            if (
              error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token'
            ) {
              await DeviceTokenModel.removeByToken(dt.token);
              console.log(`Removed invalid FCM token for user ${userId}`);
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
