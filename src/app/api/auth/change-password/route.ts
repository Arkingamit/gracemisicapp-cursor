import { NextRequest } from 'next/server';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';

// POST /api/auth/change-password - Change own password (authenticated users only)
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return Response.json({ error: 'Old and new passwords are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return Response.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
    }

    // Verify old password
    const user = await UserModel.authenticate(auth.email, oldPassword);
    if (!user) {
      return Response.json({ error: 'Invalid old password' }, { status: 401 });
    }

    const success = await UserModel.updatePassword(user.id, newPassword);
    
    if (!success) {
      return Response.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return Response.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

