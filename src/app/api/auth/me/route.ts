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

export async function PATCH(request: NextRequest) {
  try {
    const authPayload = getAuthUser(request);
    if (!authPayload) {
      return authError('Not authenticated');
    }

    const updates = await request.json();
    
    // Only allow specific fields to be updated
    const allowedUpdates: Record<string, any> = {};
    const editableFields = ['displayName', 'photoURL', 'church', 'age', 'instrument'];
    
    editableFields.forEach(field => {
      if (updates[field] !== undefined) {
        allowedUpdates[field] = updates[field];
      }
    });

    const updatedUser = await UserModel.update(authPayload.userId, allowedUpdates);
    
    if (!updatedUser) {
      return authError('Failed to update user', 500);
    }

    return Response.json({ user: updatedUser });
  } catch (error) {
    console.error('Update current user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
