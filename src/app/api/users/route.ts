import { NextRequest } from 'next/server';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';
import { validateQuery } from '@/server/validation/http';

const usersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional(),
  })
  .strict();

// GET /api/users - List all users (super_admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    if (auth.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can access user list' }, { status: 403 });
    }

    const queryCheck = validateQuery(request, usersQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '1000');

    const users = await UserModel.list(page, limit);
    return Response.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

