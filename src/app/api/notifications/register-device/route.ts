import { NextRequest } from 'next/server';
import { DeviceTokenModel } from '@/server/models/deviceToken';
import { getAuthUser, authError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const body = await request.json();
    const { token, platform } = body;

    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'Invalid device token' }, { status: 400 });
    }

    if (!platform || !['android', 'ios'].includes(platform)) {
      return Response.json(
        { error: 'Invalid platform. Must be "android" or "ios".' },
        { status: 400 }
      );
    }

    await DeviceTokenModel.upsert(auth.userId, token, platform);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Register device token error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
