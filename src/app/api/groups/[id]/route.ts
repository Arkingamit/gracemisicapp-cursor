import { NextRequest } from 'next/server';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';

// GET /api/groups/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { id } = await params;
    const group = await GroupModel.findById(id);
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // Visibility check
    const isSuperAdmin = auth.role === 'super_admin';
    const isGroupMember = group.members.includes(auth.userId);
    
    // Check if user is part of the parent organization
    const org = await OrganizationModel.findById(group.organizationId);
    const isOrgManager = org?.managerIds?.includes(auth.userId) ?? false;
    const isOrgMember = org?.members?.includes(auth.userId) ?? false;

    if (!isSuperAdmin && !isGroupMember && !isOrgManager && !isOrgMember) {
      return Response.json(
        { error: 'You do not have access to this group' },
        { status: 403 }
      );
    }

    return Response.json({ group });
  } catch (error) {
    console.error('Get group error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/groups/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { id } = await params;
    const group = await GroupModel.findById(id);
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

    const org = await OrganizationModel.findById(group.organizationId);
    const isSuperAdmin = auth.role === 'super_admin';
    const isOrgManager = org?.managerIds?.includes(auth.userId) ?? false;
    const isOrgEditor = (org?.editorIds || []).includes(auth.userId);
    const isGroupCreator = group.createdBy === auth.userId;

    // Only org editors, managers, group creator, or super_admin can update a group
    if (!isSuperAdmin && !isOrgManager && !isOrgEditor && !isGroupCreator) {
      return Response.json(
        { error: 'Only editors or managers of the organization can update this group' },
        { status: 403 }
      );
    }

    const updates = await request.json();
    const updatedGroup = await GroupModel.update(id, updates);

    // Audit log: Song Set updated
    await AuditLogModel.log({
      collectionName: COLLECTIONS.GROUPS,
      documentId: id,
      action: 'update',
      userId: auth.userId,
      itemName: updatedGroup?.name || group.name,
    });

    return Response.json({ group: updatedGroup });
  } catch (error) {
    console.error('Update group error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/groups/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { id } = await params;
    const group = await GroupModel.findById(id);
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

    const org = await OrganizationModel.findById(group.organizationId);
    const isSuperAdmin = auth.role === 'super_admin';
    const isOrgManager = org?.managerIds?.includes(auth.userId) ?? false;

    if (!isSuperAdmin && !isOrgManager) {
      return Response.json(
        { error: 'Only managers or super admins can delete groups' },
        { status: 403 }
      );
    }

    // Audit log: Song Set deleted (log BEFORE deleting)
    await AuditLogModel.log({
      collectionName: COLLECTIONS.GROUPS,
      documentId: id,
      action: 'delete',
      userId: auth.userId,
      itemName: `${group.name}`,
    });

    const success = await GroupModel.delete(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
