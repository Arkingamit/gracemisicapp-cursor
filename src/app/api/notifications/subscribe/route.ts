import { NextRequest } from 'next/server';
import { PushSubscriptionModel } from '@/server/models/pushSubscription';
import { getAuthUser, authError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return Response.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    await PushSubscriptionModel.upsert(auth.userId, subscription);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
