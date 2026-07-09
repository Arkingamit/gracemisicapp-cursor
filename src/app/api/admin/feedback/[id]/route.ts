import { NextRequest } from 'next/server';
import { FeedbackModel } from '@/server/models/feedback';
import { UserModel } from '@/server/models/user';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = getAuthUser(request);
    if (!decoded) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requester = await UserModel.findById(decoded.userId);
    if (!requester || requester.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const { status } = await request.json();

    if (!['new', 'in-progress', 'resolved'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    const success = await FeedbackModel.updateStatus(id, status);
    if (success) {
      return Response.json({ message: 'Status updated' });
    } else {
      return Response.json({ error: 'Feedback not found or update failed' }, { status: 404 });
    }
  } catch (error) {
    console.error('Update feedback error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = getAuthUser(request);
    if (!decoded) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requester = await UserModel.findById(decoded.userId);
    if (!requester || requester.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const success = await FeedbackModel.delete(id);
    
    if (success) {
      return Response.json({ message: 'Feedback deleted successfully' });
    } else {
      return Response.json({ error: 'Feedback not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Delete feedback error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
