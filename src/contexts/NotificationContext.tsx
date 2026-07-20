'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useAuth, authFetch } from './AuthContext';
import { Capacitor } from '@capacitor/core';
import { initNativePushNotifications, removeNativePushListeners } from '@/lib/nativePushNotifications';
import NativePushPermissionPrompt from '@/components/common/NativePushPermissionPrompt';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  requestPushPermission: () => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  pushPermission: NotificationPermission;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const { currentUser } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/notifications');
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      // Poll every 1 minute
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setLoading(false);
    }
  }, [currentUser, fetchNotifications]);

  // On native, try silent register if already granted; otherwise the in-app
  // prompt will ask the user and then show the Android system permission dialog.
  const nativePushInitialized = useRef(false);
  useEffect(() => {
    if (currentUser && Capacitor.isNativePlatform() && !nativePushInitialized.current) {
      nativePushInitialized.current = true;
      // Do not force the system dialog here — NativePushPermissionPrompt handles UX.
      initNativePushNotifications(false).catch(console.error);
    }

    // Cleanup listeners when user logs out
    if (!currentUser && nativePushInitialized.current) {
      nativePushInitialized.current = false;
      removeNativePushListeners().catch(console.error);
    }
  }, [currentUser]);

  // Web push permission prompt
  useEffect(() => {
    if (currentUser && !Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        requestPushPermission();
      }
    }
  }, [currentUser]);

  const requestPushPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      const result = await initNativePushNotifications(true);
      setPushPermission(result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'default');
      return;
    }

    if (!('Notification' in window)) return;
    
    const permission = await Notification.requestPermission();
    setPushPermission(permission);

    if (permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) return;

        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        await authFetch('/api/notifications/subscribe', {
          method: 'POST',
          body: JSON.stringify({ subscription })
        });
      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;

    // Snapshot only the ones we're flipping so we can restore precisely
    const previousUnread = notifications.filter(
      (n) => notificationIds.includes(n.id) && !n.isRead
    );
    if (previousUnread.length === 0) return;

    // Optimistic: badge/list update immediately
    setNotifications((prev) =>
      prev.map((n) =>
        notificationIds.includes(n.id) ? { ...n, isRead: true } : n
      )
    );

    try {
      const res = await authFetch('/api/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ notificationIds }),
      });
      if (!res.ok) throw new Error('mark-read failed');
    } catch (error) {
      console.error('Error marking notifications read:', error);
      // Rollback unread state for the ones we optimistically marked
      const restoreIds = new Set(previousUnread.map((n) => n.id));
      setNotifications((prev) =>
        prev.map((n) => (restoreIds.has(n.id) ? { ...n, isRead: false } : n))
      );
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        requestPushPermission,
        markAsRead,
        pushPermission
      }}
    >
      {children}
      <NativePushPermissionPrompt enabled={!!currentUser} />
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
