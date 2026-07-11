import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { User } from '@/lib/types';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Add it to your .env.local file.'
    );
  }
  return secret;
};

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Creates a signed JWT token for an authenticated user.
 * Expires in 7 days.
 */
export function createToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Verifies and decodes a JWT token.
 * Returns null if the token is invalid or expired.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extracts the authenticated user from a request.
 * Checks HttpOnly cookies first, then falls back to Authorization header.
 */
export function getAuthUser(request: NextRequest): JWTPayload | null {
  // Primary: HttpOnly cookie (secure, production method)
  let token = request.cookies.get('token')?.value;

  // Fallback: Authorization header (for backward compatibility / API testing)
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return null;
  return verifyToken(token);
}

/**
 * Helper to create a standard JSON 401 Unauthorized response.
 */
export function authError(message: string, status = 401) {
  return Response.json({ error: message }, { status });
}
