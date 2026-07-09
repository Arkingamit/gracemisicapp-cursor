import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { UserModel } from '@/server/models/user';
import { createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return Response.json({ error: 'Username, email, and password are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return Response.json({ error: 'User with this email already exists' }, { status: 409 });
    }

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

