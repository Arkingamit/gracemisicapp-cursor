import { NextRequest } from 'next/server';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { sendNotificationToUsers } from '@/server/utils/pushNotifications';
import { COLLECTIONS } from '@/server/db/collections';
import { SettingsModel } from '@/server/models/settings';
import { getCollection } from '@/server/db/connection';
import { enforceRateLimit } from '@/server/rateLimit';
import { compressedJson } from '@/server/compress';
import { z } from 'zod';
import { validateBody, validateQuery } from '@/server/validation/http';
import { boundedString, objectId, objectIdArray, NAME_MAX } from '@/server/validation/schemas';

const groupsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    organizationId: objectId.optional(),
    memberId: objectId.optional(),
  })
  .strict();

const groupCreateSchema = z
  .object({
    name: boundedString(NAME_MAX),
    organizationId: objectId,
    members: objectIdArray.max(1000).optional(),
    description: z.string().max(1000).optional(),
  })
  .strict();

// GET /api/groups - List groups with visibility restrictions
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const queryCheck = validateQuery(request, groupsQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const organizationId = searchParams.get('organizationId') || undefined;
    let memberId = searchParams.get('memberId') || undefined;

    // Enforce visibility for non-super-admins
    if (auth.role !== 'super_admin') {
      if (organizationId) {
        // If viewing an organization's groups, check if user is manager or member
        const org = await OrganizationModel.findById(organizationId);
        const isOrgManager = org?.managerIds?.includes(auth.userId) ?? false;
        const isOrgMember = org?.members?.includes(auth.userId) ?? false;
        
        if (!isOrgManager && !isOrgMember) {
          // If not in the org, only show groups they are explicitly members of
          memberId = auth.userId;
        }
        // If they are part of the org, they see all groups (memberId remains search param or undefined)
      } else {
        // Global group list: show groups they are members of OR groups from their organizations
        const userOrgs = await OrganizationModel.listByMember(auth.userId);
        const userOrgIds = userOrgs.map(o => o.id);

        const groups = await GroupModel.listForUser(auth.userId, userOrgIds, page, limit);
        return compressedJson(request, { groups });
      }
    }

    const groups = await GroupModel.list({ organizationId, memberId }, page, limit);
    return compressedJson(request, { groups });
  } catch (error) {
    console.error('List groups error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/groups - Create a new group
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const limited = await enforceRateLimit(request, {
      policy: 'authenticated',
      bucket: 'groups-create',
      identifier: auth.userId,
    });
    if (limited) return limited;

    const parsed = await validateBody(request, groupCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Check if user can create groups in this organization
    const org = await OrganizationModel.findById(body.organizationId);
    if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });
    
    const isSuperAdmin = auth.role === 'super_admin';
    const isManager = org.managerIds.includes(auth.userId);
    const isMember = org.members.includes(auth.userId);
    
    if (!isSuperAdmin && !isManager && !isMember) {
      return Response.json(
        { error: 'Only members of the organization can create groups' },
        { status: 403 }
      );
    }

    if (!isSuperAdmin) {
      const settings = await SettingsModel.getSettings();
      const groupsCollection = await getCollection(COLLECTIONS.GROUPS);
      const userGroupCount = await groupsCollection.countDocuments({ createdBy: auth.userId });
      
      if (userGroupCount >= settings.max_groups_per_user) {
        return Response.json(
          { error: `You have reached the maximum limit of ${settings.max_groups_per_user} groups per user.` },
          { status: 403 }
        );
      }
    }

    const group = await GroupModel.create(
      body as Parameters<typeof GroupModel.create>[0],
      auth.userId
    );

    // Audit log: Song Set created
    await AuditLogModel.log({
      collectionName: COLLECTIONS.GROUPS,
      documentId: group.id,
      action: 'create',
      userId: auth.userId,
      itemName: `${group.name} (in ${org.name})`,
    });

    // Notify organization members (one batched insert, don't notify the creator)
    const recipients = (org.members || []).filter((memberId) => memberId !== auth.userId);
    await sendNotificationToUsers(
      recipients,
      'New Song Set Created',
      `A new song set "${group.name}" was created in "${org.name}".`,
      `/organizations/view?id=${org.id}&tab=song-sets&groupId=${group.id}`
    );

    return Response.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Create group error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

