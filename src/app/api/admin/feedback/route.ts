import { NextRequest } from 'next/server';
import { FeedbackModel } from '@/server/models/feedback';
import { UserModel } from '@/server/models/user';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthUser(request);
    if (!decoded) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requester = await UserModel.findById(decoded.userId);
    if (!requester || requester.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const feedbacks = await FeedbackModel.list();
    return Response.json({ feedbacks });
  } catch (error) {
    console.error('List feedback error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
