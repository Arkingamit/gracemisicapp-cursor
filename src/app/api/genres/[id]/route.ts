import { NextRequest } from 'next/server';
import { GenreModel } from '@/server/models/genre';
import { UserModel } from '@/server/models/user';
import { verifyToken } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if requester is super_admin
    const requester = await UserModel.findById(decoded.userId);
    if (!requester || requester.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return Response.json({ error: 'Genre ID is required' }, { status: 400 });
    }

    const deleted = await GenreModel.delete(id);
    if (!deleted) {
      return Response.json({ error: 'Genre not found or could not be deleted' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete genre error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
