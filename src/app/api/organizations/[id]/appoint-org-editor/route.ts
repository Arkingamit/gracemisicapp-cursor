import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const appointOrgEditorSchema = z
  .object({
    userId: objectId,
    role: z.enum(['user', 'editor', 'manager']).optional(),
    action: z.enum(['promote', 'demote']).optional(),
  })
  .strict();

// POST /api/organizations/[id]/appoint-org-editor — Manager sets a member's org role
// Accepts: { userId, role: 'user' | 'editor' | 'manager' }
// Also supports legacy: { userId, action: 'promote' | 'demote' }
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

    const parsed = await validateBody(request, appointOrgEditorSchema);
    if (!parsed.ok) return parsed.response;
    const { userId, role, action } = parsed.data;

    // Support both new `role` param and legacy `action` param
    let targetRole: string;
    if (role && ['user', 'editor', 'manager'].includes(role)) {
      targetRole = role;
    } else if (action === 'promote') {
      targetRole = 'editor';
    } else if (action === 'demote') {
      targetRole = 'user';
    } else {
      return Response.json({ error: 'Role must be "user", "editor", or "manager"' }, { status: 400 });
    }

    // Verify organization exists
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only super_admin or an org manager can change roles
    const isSuperAdmin = auth.role === 'super_admin';
    const isManager = organization.managerIds.includes(auth.userId);

    if (!isSuperAdmin && !isManager) {
      return Response.json(
        { error: 'Only managers can change member roles' },
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

    // Cannot change your own role
    if (userId === auth.userId && !isSuperAdmin) {
      return Response.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      );
    }

    // Apply role change: clear old roles then set new one
    let updatedOrg = organization;

    // First, remove from both managerIds and editorIds
    const wasManager = organization.managerIds.includes(userId);
    const wasEditor = (organization.editorIds || []).includes(userId);

    if (wasManager) {
      updatedOrg = (await OrganizationModel.removeManagerRole(orgId, userId))!;
    }
    if (wasEditor) {
      updatedOrg = (await OrganizationModel.removeEditorRole(orgId, userId))!;
    }

    // Then set the new role
    if (targetRole === 'manager') {
      updatedOrg = (await OrganizationModel.addManager(orgId, userId))!;
    } else if (targetRole === 'editor') {
      updatedOrg = (await OrganizationModel.addEditor(orgId, userId))!;
    }
    // 'user' = no special role, just a member (already removed from both arrays)

    return Response.json({ organization: updatedOrg });
  } catch (error) {
    console.error('Set org role error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
