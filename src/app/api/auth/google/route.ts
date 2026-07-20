import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { createToken } from '@/lib/auth';
import { validateBody } from '@/server/validation/http';
import {
  checkAuthRateLimit,
  recordAuthFailure,
  recordAuthSuccess,
} from '@/server/rateLimit';

const googleAuthSchema = z
  .object({
    idToken: z.string().min(20).max(8000),
  })
  .strict();

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '810353645969-dmsbou0itk6475tap5j8qq7ejvs68dm7.apps.googleusercontent.com';

interface GoogleTokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  const data = (await res.json()) as GoogleTokenInfo;
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Invalid Google ID token');
  }
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, googleAuthSchema);
    if (!parsed.ok) return parsed.response;
    const { idToken } = parsed.data;

    let info: GoogleTokenInfo;
    try {
      info = await verifyGoogleIdToken(idToken);
    } catch (error) {
      console.error('Google token verification failed:', error);
      return Response.json({ error: 'Invalid Google sign-in token' }, { status: 401 });
    }

    if (info.aud !== GOOGLE_CLIENT_ID) {
      console.error('Google token audience mismatch:', info.aud);
      return Response.json({ error: 'Google token audience mismatch' }, { status: 401 });
    }

    const email = info.email?.trim().toLowerCase();
    const sub = info.sub;
    if (!email || !sub) {
      return Response.json({ error: 'Google account email is required' }, { status: 400 });
    }

    const emailVerified =
      info.email_verified === true || info.email_verified === 'true';
    if (!emailVerified) {
      return Response.json({ error: 'Google email is not verified' }, { status: 403 });
    }

    const limited = await checkAuthRateLimit(request, email);
    if (limited) return limited;

    let user = await UserModel.findByEmail(email);

    if (!user) {
      const username =
        (info.name && info.name.trim().length >= 2
          ? info.name.trim()
          : email.split('@')[0]
        ).slice(0, 60) || `user_${sub.slice(0, 8)}`;

      try {
        user = await UserModel.create(username, email, `google_${sub}`);
        if (info.picture) {
          const updated = await UserModel.update(user.id, {
            photoURL: info.picture,
            displayName: info.name || username,
          });
          if (updated) user = updated;
        }
      } catch (error) {
        console.error('Google user create failed:', error);
        await recordAuthFailure(request, email);
        return Response.json({ error: 'Could not create account' }, { status: 500 });
      }
    }

    await recordAuthSuccess(email);
    const token = createToken(user);

    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return Response.json({ user, token });
  } catch (error) {
    console.error('Google auth error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
