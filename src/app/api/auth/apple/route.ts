import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UserModel } from '@/server/models/user';
import { createToken } from '@/lib/auth';
import { validateBody } from '@/server/validation/http';
import {
  checkAuthRateLimit,
  recordAuthFailure,
  recordAuthSuccess,
} from '@/server/rateLimit';

const appleAuthSchema = z
  .object({
    idToken: z.string().min(20).max(8000),
    fullName: z.string().trim().max(120).optional(),
  })
  .strict();

/** Native iOS bundle ID(s) + optional web Services ID (comma-separated). */
const APPLE_CLIENT_IDS = (
  process.env.APPLE_CLIENT_IDS ||
  process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ||
  // Prefer current iOS Bundle ID; keep legacy for transition.
  'org.graceahmedabad.music.ios,org.graceahmedabad.music'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const appleJwks = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys')
);

interface AppleClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  iss?: string;
  aud?: string | string[];
}

async function verifyAppleIdToken(idToken: string): Promise<AppleClaims> {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience: APPLE_CLIENT_IDS,
  });
  return payload as AppleClaims;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, appleAuthSchema);
    if (!parsed.ok) return parsed.response;
    const { idToken, fullName } = parsed.data;

    let claims: AppleClaims;
    try {
      claims = await verifyAppleIdToken(idToken);
    } catch (error) {
      console.error('Apple token verification failed:', error);
      return Response.json({ error: 'Invalid Apple sign-in token' }, { status: 401 });
    }

    const sub = claims.sub;
    if (!sub) {
      return Response.json({ error: 'Apple account subject is required' }, { status: 400 });
    }

    // Apple may omit email on subsequent sign-ins; use private relay placeholder if needed.
    let email = claims.email?.trim().toLowerCase();
    if (!email) {
      email = `apple_${sub.slice(0, 32)}@privaterelay.appleid.com`.toLowerCase();
    }

    const limited = await checkAuthRateLimit(request, email);
    if (limited) return limited;

    let user = await UserModel.findByEmail(email);

    // Also try finding by apple_* password pattern users who signed in before without email
    // (kept simple: email is the primary key for this app)

    if (!user) {
      const usernameBase =
        (fullName && fullName.trim().length >= 2
          ? fullName.trim()
          : email.includes('@privaterelay.appleid.com')
            ? `apple_${sub.slice(0, 8)}`
            : email.split('@')[0]
        ).slice(0, 60) || `apple_${sub.slice(0, 8)}`;

      try {
        user = await UserModel.create(usernameBase, email, `apple_${sub}`);
        if (fullName?.trim()) {
          const updated = await UserModel.update(user.id, {
            displayName: fullName.trim(),
            name: fullName.trim(),
          });
          if (updated) user = updated;
        }
      } catch (error) {
        console.error('Apple user create failed:', error);
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
    console.error('Apple auth error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
