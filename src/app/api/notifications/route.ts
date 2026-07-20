import { NextRequest } from 'next/server';
import { z } from 'zod';
import { NotificationModel } from '@/server/models/notification';
import { getAuthUser, authError } from '@/lib/auth';
import { validateQuery } from '@/server/validation/http';

const notificationsQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(500).optional() })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const queryCheck = validateQuery(request, notificationsQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const notifications = await NotificationModel.findByUserId(auth.userId, limit);

    return Response.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
