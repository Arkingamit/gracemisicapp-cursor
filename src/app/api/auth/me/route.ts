import { NextRequest } from 'next/server';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody } from '@/server/validation/http';

const updateProfileSchema = z
  .object({
    displayName: z.string().max(120).nullish(),
    photoURL: z.string().max(2_000_000).nullish(),
    church: z.string().max(120).nullish(),
    age: z.coerce.number().int().min(1).max(120).nullish(),
    instrument: z.string().max(80).nullish(),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const authPayload = getAuthUser(request);
    if (!authPayload) {
      return authError('Not authenticated');
    }

    const user = await UserModel.findById(authPayload.userId);
    if (!user) {
      return authError('User not found', 404);
    }

    return Response.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authPayload = getAuthUser(request);
    if (!authPayload) {
      return authError('Not authenticated');
    }

    const parsed = await validateBody(request, updateProfileSchema);
    if (!parsed.ok) return parsed.response;

    // Strict schema guarantees only these known fields are present.
    const updatedUser = await UserModel.update(authPayload.userId, parsed.data);
    
    if (!updatedUser) {
      return authError('Failed to update user', 500);
    }

    return Response.json({ user: updatedUser });
  } catch (error) {
    console.error('Update current user error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
