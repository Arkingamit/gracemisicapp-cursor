import { NextRequest } from 'next/server';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { sendNotificationToUser } from '@/server/utils/pushNotifications';
import { COLLECTIONS } from '@/server/db/collections';
import { SettingsModel } from '@/server/models/settings';
import { getCollection } from '@/server/db/connection';

// GET /api/groups - List groups with visibility restrictions
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

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
        return Response.json({ groups });
      }
    }

    const groups = await GroupModel.list({ organizationId, memberId }, page, limit);
    return Response.json({ groups });
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

    const body = await request.json();
    
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

    const group = await GroupModel.create(body, auth.userId);

    // Audit log: Song Set created
    await AuditLogModel.log({
      collectionName: COLLECTIONS.GROUPS,
      documentId: group.id,
      action: 'create',
      userId: auth.userId,
      itemName: `${group.name} (in ${org.name})`,
    });

    // Notify organization members
    const orgMembers = org.members || [];
    for (const memberId of orgMembers) {
      if (memberId !== auth.userId) { // don't notify the creator
        await sendNotificationToUser(
          memberId,
          'New Song Set Created',
          `A new song set "${group.name}" was created in "${org.name}".`,
          `/organizations/view?id=${org.id}&tab=song-sets&groupId=${group.id}`
        );
      }
    }

    return Response.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Create group error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

