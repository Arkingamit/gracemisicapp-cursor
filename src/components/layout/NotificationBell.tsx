'use client';

import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useNotifications, type Notification } from '@/contexts/NotificationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, pushPermission, requestPushPermission } =
    useNotifications();
  const router = useRouter();
  /** Snapshot of notifications shown while the panel is open (marked read on open). */
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const unread = notifications.filter((n) => !n.isRead);
      setVisibleNotifications(unread);
      if (unread.length > 0) {
        void markAsRead(unread.map((n) => n.id));
      }
    } else {
      setVisibleNotifications([]);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          <span>Notifications</span>
        </DropdownMenuLabel>

        {pushPermission === 'default' && (
          <>
            <DropdownMenuSeparator />
            <Alert className="mx-2 my-1 w-auto border-zinc-800 bg-zinc-900 p-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-6">
              <BellRing className="h-4 w-4 text-zinc-400" />
              <AlertTitle className="text-xs text-zinc-200">Stay updated</AlertTitle>
              <AlertDescription className="text-xs text-zinc-400">
                Enable push notifications
              </AlertDescription>
              <AlertAction className="right-2 top-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestPushPermission}
                  className="h-7 text-xs"
                >
                  Enable
                </Button>
              </AlertAction>
            </Alert>
          </>
        )}

        <DropdownMenuSeparator />

        <div className="max-h-[300px] overflow-y-auto">
          {visibleNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              No new notifications
            </div>
          ) : (
            visibleNotifications.map((notification) => (
              <Alert
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(notification)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(notification);
                  }
                }}
                className="mb-1 w-auto cursor-pointer border-zinc-700/50 bg-zinc-800/60 p-3 transition-colors last:mb-0 hover:bg-zinc-800/80 [&>svg]:left-3 [&>svg]:top-[15px] [&>svg~*]:pl-5"
              >
                <span className="absolute left-3 top-[15px] block h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                <AlertTitle className="pl-5 pr-16 truncate text-sm font-semibold text-white">
                  {notification.title}
                </AlertTitle>
                <AlertDescription className="pl-5 text-xs leading-relaxed text-zinc-300 line-clamp-2">
                  {notification.message}
                </AlertDescription>
                <AlertAction className="right-3 top-3">
                  <span className="text-[10px] font-medium text-zinc-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                </AlertAction>
              </Alert>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
