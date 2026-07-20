import { NextRequest } from 'next/server';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';
import {
  checkAuthRateLimit,
  recordAuthFailure,
  recordAuthSuccess,
} from '@/server/rateLimit';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, loginPassword } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const resetPasswordSchema = z.object({ adminPassword: loginPassword }).strict();

// POST /api/users/[id]/reset-password - Reset a user's password to a temporary password (super_admin only)
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

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const parsed = await validateBody(request, resetPasswordSchema);
    if (!parsed.ok) return parsed.response;
    const { adminPassword } = parsed.data;

    // Admin password re-verification is a brute-force target — rate limit it.
    const limited = await checkAuthRateLimit(request, auth.email);
    if (limited) return limited;

    // Verify admin's password
    const isAdminValid = await UserModel.authenticate(auth.email, adminPassword);
    if (!isAdminValid) {
      await recordAuthFailure(request, auth.email);
      return Response.json({ error: "Invalid administrator password" }, { status: 401 });
    }
    await recordAuthSuccess(auth.email);

    const user = await UserModel.findById(id);
    if (user?.email === 'admin@example.com') {
      return Response.json({ error: 'Cannot reset password for the system admin account' }, { status: 400 });
    }

    // Temporary password is configurable via env; the admin is shown the
    // actual value in the response so it is never hardcoded in the client.
    const temporaryPassword = process.env.DEFAULT_RESET_PASSWORD || 'password123';
    const success = await UserModel.updatePassword(id, temporaryPassword);
    
    if (!success) {
      return Response.json({ error: 'Failed to reset password' }, { status: 500 });
    }

    return Response.json({
      message: 'Password reset successfully.',
      temporaryPassword,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
