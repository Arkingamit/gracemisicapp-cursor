import { NextRequest } from 'next/server';
import { NotificationModel } from '@/server/models/notification';
import { getAuthUser, authError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const body = await request.json();
    const { notificationIds } = body;

    if (!Array.isArray(notificationIds)) {
      return Response.json({ error: 'notificationIds must be an array' }, { status: 400 });
    }

    const success = await NotificationModel.markAsRead(notificationIds, auth.userId);

    return Response.json({ success });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
