import { NextRequest } from 'next/server';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { OrganizationModel } from '@/server/models/organization';
import { SYSTEM_ADMIN_EMAIL } from '@/lib/constants';
import { verifyToken } from '@/lib/auth';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

const updateUserSchema = z
  .object({ aiChatLimitMB: z.coerce.number().min(0).max(100000).nullish() })
  .strict();

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

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    // Check if target user exists
    const targetUser = await UserModel.findById(id);
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting the system admin
    if (targetUser.email === SYSTEM_ADMIN_EMAIL) {
      return Response.json({ error: 'Cannot delete system admin account' }, { status: 400 });
    }

    // Prevent deleting self
    if (targetUser.id === requester.id) {
      return Response.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    // Safety check: Is the user a manager of any organization?
    const userOrgs = await OrganizationModel.listByMember(id);
    const isManager = userOrgs.some((org: any) => org.managerId === id);

    if (isManager) {
      return Response.json({ 
        error: 'Cannot delete user: They are a manager of one or more organizations. Please re-assign management first.' 
      }, { status: 400 });
    }

    const success = await UserModel.delete(id);
    if (success) {
      return Response.json({ message: 'User deleted successfully' });
    } else {
      return Response.json({ error: 'Failed to delete user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Delete user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const parsed = await validateBody(request, updateUserSchema);
    if (!parsed.ok) return parsed.response;

    // Check if target user exists
    const targetUser = await UserModel.findById(id);
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const allowedUpdates: Record<string, unknown> = {};
    if (parsed.data.aiChatLimitMB !== undefined) {
      allowedUpdates.aiChatLimitMB = parsed.data.aiChatLimitMB;
    }

    const updatedUser = await UserModel.update(id, allowedUpdates);
    return Response.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
