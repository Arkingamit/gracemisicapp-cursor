import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';
import { getAuthUser, authError } from '@/lib/auth';
import { validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

// GET /api/organizations/[id]/members — Get member details for an organization
export async function GET(
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

    // Verify organization exists
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only super_admin, the org manager, org editors, or org members can view the member list
    const isSuperAdmin = auth.role === 'super_admin';
    const isManager = organization.managerIds.includes(auth.userId);
    const isEditor = (organization.editorIds || []).includes(auth.userId);
    const isMember = organization.members.includes(auth.userId);

    if (!isSuperAdmin && !isManager && !isEditor && !isMember) {
      return Response.json(
        { error: 'You do not have access to view this organization\'s members' },
        { status: 403 }
      );
    }

    // Fetch user details for each member
    const memberDetails = await Promise.all(
      organization.members.map(async (memberId) => {
        const user = await UserModel.findById(memberId);
        if (user) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            isManager: organization.managerIds.includes(user.id),
            isEditor: (organization.editorIds || []).includes(user.id),
          };
        }
        return null;
      })
    );

    const validMembers = memberDetails.filter(Boolean);

    return Response.json({ members: validMembers });
  } catch (error) {
    console.error('Get members error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
