import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';

// GET /api/organizations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { id } = await params;
    const organization = await OrganizationModel.findById(id);
    if (!organization) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Visibility check
    const isSuperAdmin = auth.role === 'super_admin';
    const isMember = organization.members.includes(auth.userId);
    const isManager = organization.managerIds.includes(auth.userId);

    if (!isSuperAdmin && !isMember && !isManager) {
      return Response.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    return Response.json({ organization });
  } catch (error) {
    console.error('Get organization error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/organizations/[id] — super_admin or org manager
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { id } = await params;
    const org = await OrganizationModel.findById(id);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    const isSuperAdmin = auth.role === 'super_admin';
    const isManager = org.managerIds.includes(auth.userId);

    if (!isSuperAdmin && !isManager) {
      return Response.json(
        { error: 'Only super admins or the organization manager can update this organization' },
        { status: 403 }
      );
    }

    const updates = await request.json();

    if (!isSuperAdmin) {
      delete updates.maxMembersLimit;
      delete updates.maxSongsPerGroupLimit;
      delete updates.maxCustomSongsLimit;
    }

    const organization = await OrganizationModel.update(id, updates);

    // Audit log: Organization updated
    await AuditLogModel.log({
      collectionName: COLLECTIONS.ORGANIZATIONS,
      documentId: id,
      action: 'update',
      userId: auth.userId,
      itemName: organization?.name || org.name,
    });

    return Response.json({ organization });
  } catch (error) {
    console.error('Update organization error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id] — super_admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { id } = await params;
    const org = await OrganizationModel.findById(id);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    const isSuperAdmin = auth.role === 'super_admin';
    const isManager = org.managerIds.includes(auth.userId);

    if (!isSuperAdmin && !isManager) {
      return Response.json(
        { error: 'Only super admins or the organization manager can delete this organization' },
        { status: 403 }
      );
    }

    // Audit log: Organization deleted (log BEFORE deleting)
    await AuditLogModel.log({
      collectionName: COLLECTIONS.ORGANIZATIONS,
      documentId: id,
      action: 'delete',
      userId: auth.userId,
      itemName: org.name,
    });

    const success = await OrganizationModel.delete(id);
    if (!success) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete organization error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
