import { NextRequest } from 'next/server';
import { z } from 'zod';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';
import { UserRole } from '@/lib/types';
import { hasAnyRole, sanitizeRolesInput } from '@/lib/roles';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, userRoleEnum } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

const updateRoleSchema = z
  .object({
    roles: z.array(userRoleEnum).min(1).optional(),
    role: userRoleEnum.optional(),
  })
  .strict()
  .refine((d) => d.roles !== undefined || d.role !== undefined, {
    message: 'either "role" or "roles" is required',
  });

// PATCH /api/users/[id]/role - Update a user's role(s) (super_admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    if (!hasAnyRole(auth, 'super_admin')) {
      return Response.json({ error: 'Only super admins can update roles globally' }, { status: 403 });
    }

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const parsed = await validateBody(request, updateRoleSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    let roles: UserRole[];
    if (Array.isArray(body.roles)) {
      roles = sanitizeRolesInput(body.roles);
    } else {
      roles = sanitizeRolesInput([body.role as UserRole]);
    }

    const updatedUser = await UserModel.updateRole(id, roles);
    if (!updatedUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user role error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
