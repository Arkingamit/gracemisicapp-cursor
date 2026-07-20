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
import {
  email as emailSchema,
  newPassword,
  boundedString,
} from '@/server/validation/schemas';

const registerSchema = z
  .object({
    username: boundedString(60, { min: 2 }),
    email: emailSchema,
    password: newPassword,
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, registerSchema);
    if (!parsed.ok) return parsed.response;
    const { username, email, password } = parsed.data;

    // Strict limiting to curb signup abuse and email enumeration.
    const limited = await checkAuthRateLimit(request, email);
    if (limited) return limited;

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      // Slow down repeated probing for existing accounts.
      await recordAuthFailure(request, email);
      return Response.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    await recordAuthSuccess(email);
    const user = await UserModel.create(username, email, password);
    const token = createToken(user);

    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return Response.json({ user, token }, { status: 201 });
  } catch (error) {
    console.error('Register error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

