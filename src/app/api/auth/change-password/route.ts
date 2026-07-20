import { NextRequest } from 'next/server';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';
import {
  checkAuthRateLimit,
  recordAuthFailure,
  recordAuthSuccess,
} from '@/server/rateLimit';
import { validateBody } from '@/server/validation/http';
import { loginPassword, newPassword as newPasswordSchema } from '@/server/validation/schemas';

const changePasswordSchema = z
  .object({ oldPassword: loginPassword, newPassword: newPasswordSchema })
  .strict();

// POST /api/auth/change-password - Change own password (authenticated users only)
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const parsed = await validateBody(request, changePasswordSchema);
    if (!parsed.ok) return parsed.response;
    const { oldPassword, newPassword } = parsed.data;

    // Verifying the old password is a brute-force target — rate limit it.
    const limited = await checkAuthRateLimit(request, auth.email);
    if (limited) return limited;

    // Verify old password
    const user = await UserModel.authenticate(auth.email, oldPassword);
    if (!user) {
      await recordAuthFailure(request, auth.email);
      return Response.json({ error: 'Invalid old password' }, { status: 401 });
    }

    await recordAuthSuccess(auth.email);
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

