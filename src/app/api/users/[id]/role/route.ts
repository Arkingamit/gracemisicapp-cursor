import { NextRequest } from 'next/server';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';

// PATCH /api/users/[id]/role - Update a user's role (super_admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    if (auth.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can update roles globally' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role) {
      return Response.json({ error: 'Role is required' }, { status: 400 });
    }

    const updatedUser = await UserModel.updateRole(id, role);
    if (!updatedUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user role error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
