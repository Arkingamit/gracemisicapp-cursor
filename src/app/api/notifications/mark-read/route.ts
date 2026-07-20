import { NextRequest } from 'next/server';
import { z } from 'zod';
import { NotificationModel } from '@/server/models/notification';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const markReadSchema = z
  .object({ notificationIds: z.array(objectId).max(1000) })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const parsed = await validateBody(request, markReadSchema);
    if (!parsed.ok) return parsed.response;
    const { notificationIds } = parsed.data;

    const success = await NotificationModel.markAsRead(notificationIds, auth.userId);

    return Response.json({ success });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
