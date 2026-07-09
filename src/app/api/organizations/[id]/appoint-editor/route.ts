import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';

// POST /api/organizations/[id]/appoint-editor — Manager appoints an editor
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
    const body = await request.json();
    const { userId, role } = body; // role should be 'editor' or 'user' (to revoke)

    if (!userId || typeof userId !== 'string') {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify organization exists
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only super_admin or the org manager can appoint editors
    const isSuperAdmin = auth.role === 'super_admin';
    const isManager = organization.managerIds.includes(auth.userId);

    if (!isSuperAdmin && !isManager) {
      return Response.json(
        { error: 'Only managers can appoint editors' },
        { status: 403 }
      );
    }

    // Verify user is a member of the organization
    if (!organization.members.includes(userId)) {
      return Response.json(
        { error: 'User must be a member of the organization' },
        { status: 400 }
      );
    }

    // Update user role
    const newRole = role === 'editor' ? 'editor' : 'user';
    await UserModel.updateRole(userId, newRole);

    return Response.json({ success: true, role: newRole });
  } catch (error) {
    console.error('Appoint editor error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
