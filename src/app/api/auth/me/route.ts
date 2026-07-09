import { NextRequest } from 'next/server';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authPayload = getAuthUser(request);
    if (!authPayload) {
      return authError('Not authenticated');
    }

    const user = await UserModel.findById(authPayload.userId);
    if (!user) {
      return authError('User not found', 404);
    }

    return Response.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

