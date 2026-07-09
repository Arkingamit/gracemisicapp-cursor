import { NextRequest } from 'next/server';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';

// POST /api/users/[id]/reset-password - Reset a user's password to password123 (super_admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    if (auth.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can reset passwords' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { adminPassword } = body;

    if (!adminPassword) {
      return Response.json({ error: "Administrator password is required for authorization" }, { status: 400 });
    }

    // Verify admin's password
    const isAdminValid = await UserModel.authenticate(auth.email, adminPassword);
    if (!isAdminValid) {
      return Response.json({ error: "Invalid administrator password" }, { status: 401 });
    }

    const user = await UserModel.findById(id);
    if (user?.email === 'admin@example.com') {
      return Response.json({ error: 'Cannot reset password for the system admin account' }, { status: 400 });
    }

    const success = await UserModel.updatePassword(id, 'password123');
    
    if (!success) {
      return Response.json({ error: 'Failed to reset password' }, { status: 500 });
    }

    return Response.json({ message: 'Password reset successfully to password123' });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
