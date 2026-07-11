import { NextRequest } from 'next/server';
import { NotificationModel } from '@/server/models/notification';
import { getAuthUser, authError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const notifications = await NotificationModel.findByUserId(auth.userId, limit);

    return Response.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
