import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { createToken } from '@/lib/auth';
import {
  checkAuthRateLimit,
  recordAuthFailure,
  recordAuthSuccess,
} from '@/server/rateLimit';
import { validateBody } from '@/server/validation/http';
import { email as emailSchema, loginPassword } from '@/server/validation/schemas';

const loginSchema = z
  .object({ email: emailSchema, password: loginPassword })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    // Strict per-IP + per-account limiting with exponential backoff.
    const limited = await checkAuthRateLimit(request, email);
    if (limited) return limited;

    const user = await UserModel.authenticate(email, password);
    if (!user) {
      await recordAuthFailure(request, email);
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await recordAuthSuccess(email);
    const token = createToken(user);
    
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return Response.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

