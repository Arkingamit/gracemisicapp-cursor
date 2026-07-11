'use client';

import { Bell } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, pushPermission, requestPushPermission } = useNotifications();
  const router = useRouter();

  const handleNotificationClick = (notificationId: string, link?: string) => {
    markAsRead([notificationId]);
    if (link) {
      router.push(link);
    }
  };

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-auto p-0 text-xs">
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        
        {pushPermission === 'default' && (
          <>
            <DropdownMenuSeparator />
            <div className="p-3 bg-zinc-900 rounded-md mx-2 my-1 flex flex-col gap-2">
              <span className="text-xs text-zinc-400">Enable push notifications to stay updated</span>
              <Button size="sm" onClick={requestPushPermission} className="w-full text-xs h-7">
                Enable Notifications
              </Button>
            </div>
          </>
        )}

        <DropdownMenuSeparator />
        
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start p-3 gap-1 cursor-pointer ${
                  !notification.isRead ? 'bg-zinc-900/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification.id, notification.link)}
              >
                <div className="flex justify-between w-full items-center gap-2">
                  <span className={`text-sm font-medium ${!notification.isRead ? 'text-white' : 'text-zinc-300'}`}>
                    {notification.title}
                  </span>
                  <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <span className={`text-xs ${!notification.isRead ? 'text-zinc-300' : 'text-zinc-500'} line-clamp-2`}>
                  {notification.message}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
