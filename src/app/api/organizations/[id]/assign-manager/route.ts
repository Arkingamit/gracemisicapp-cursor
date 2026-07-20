import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, email as emailSchema } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const emailBodySchema = z.object({ email: emailSchema }).strict();

// POST /api/organizations/[id]/assign-manager — Assign a new manager
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id: orgId } = parsedParams.data;

    // Verify organization exists first to check its manager
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only super_admin or the current manager can assign a new manager
    const isSuperAdmin = auth.role === 'super_admin';
    const isCurrentManager = organization.managerIds.includes(auth.userId);

    if (!isSuperAdmin && !isCurrentManager) {
      return Response.json(
        { error: 'Only super admins or current organization managers can assign a new manager' },
        { status: 403 }
      );
    }

    const parsed = await validateBody(request, emailBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    // Look up user by email
    const userToAssign = await UserModel.findByEmail(email.trim().toLowerCase());
    if (!userToAssign) {
      return Response.json(
        { error: 'No registered user found with that email address' },
        { status: 404 }
      );
    }

    // Assign the manager (adds to managers list)
    const updatedOrg = await OrganizationModel.addManager(orgId, userToAssign.id);

    // Update user role to manager
    await UserModel.updateRole(userToAssign.id, 'manager');

    return Response.json({ organization: updatedOrg });
  } catch (error) {
    console.error('Assign manager error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
