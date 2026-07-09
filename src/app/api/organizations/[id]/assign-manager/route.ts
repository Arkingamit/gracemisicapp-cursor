import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';

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

    const { id: orgId } = await params;

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

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

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
