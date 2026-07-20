import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';
import { SettingsModel } from '@/server/models/settings';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, email as emailSchema } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const emailBodySchema = z.object({ email: emailSchema }).strict();

// POST /api/organizations/[id]/invite — Add a member by email
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

    const parsed = await validateBody(request, emailBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    // Verify the organization exists
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Authorization: only the org manager or a super_admin can invite members
    if (!organization.managerIds.includes(auth.userId) && auth.role !== 'super_admin') {
      return Response.json(
        { error: 'Only the organization manager or a super admin can invite members' },
        { status: 403 }
      );
    }

    // Look up the user by email
    const userToAdd = await UserModel.findByEmail(email.trim().toLowerCase());
    if (!userToAdd) {
      return Response.json(
        { error: 'No registered user found with that email address' },
        { status: 404 }
      );
    }

    // Check if already a member
    if (organization.members.includes(userToAdd.id)) {
      return Response.json(
        { error: 'This user is already a member of the organization' },
        { status: 409 }
      );
    }

    if (auth.role !== 'super_admin') {
      const settings = await SettingsModel.getSettings();
      const limit = organization.maxMembersLimit ?? settings.max_members_per_org;
      if (limit && limit > 0) {
        if ((organization.members || []).length >= limit) {
          return Response.json(
            { error: `This organization has reached the maximum limit of ${limit} members.` },
            { status: 403 }
          );
        }
      }
    }

    // Add the member
    const updatedOrg = await OrganizationModel.addMember(orgId, userToAdd.id);
    return Response.json({ organization: updatedOrg });
  } catch (error) {
    console.error('Invite member error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
