import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/backend/models/organization';
import { JoinRequestModel } from '@/backend/models/joinRequest';
import { getAuthUser, authError } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string, requestId: string } }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const org = await OrganizationModel.findById(params.id);
    if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });

    // Only managers and super admins can approve/reject
    if (auth.role !== 'super_admin' && !org.managerIds.includes(auth.userId)) {
      return Response.json({ error: 'Not authorized to manage requests for this organization' }, { status: 403 });
    }

    const { status } = await request.json();
    if (status !== 'approved' && status !== 'rejected') {
      return Response.json({ error: 'Invalid status. Must be approved or rejected.' }, { status: 400 });
    }

    const joinRequest = await JoinRequestModel.findById(params.requestId);
    if (!joinRequest || joinRequest.organizationId !== params.id) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }
    
    if (joinRequest.status !== 'pending') {
      return Response.json({ error: 'Request is already processed' }, { status: 400 });
    }

    await JoinRequestModel.updateStatus(params.requestId, status);

    if (status === 'approved') {
      // Add user to org members
      const newMembers = [...new Set([...org.members, joinRequest.userId])];
      await OrganizationModel.update(org.id, { members: newMembers });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update join request error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
