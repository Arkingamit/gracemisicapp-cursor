import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { JoinRequestModel } from '@/server/models/joinRequest';
import { getAuthUser, authError } from '@/lib/auth';
import { publishOrgJoinEvent } from '@/server/realtime/orgJoinBus';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, joinRequestDecisionEnum } from '@/server/validation/schemas';

const requestParamsSchema = z.object({ id: objectId, requestId: objectId });
const decisionSchema = z.object({ status: joinRequestDecisionEnum }).strict();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, requestId: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { id: orgId, requestId } = await params;
    const parsedParams = validateParams({ id: orgId, requestId }, requestParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    const org = await OrganizationModel.findById(orgId);
    if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });

    // Only managers and super admins can approve/reject
    if (auth.role !== 'super_admin' && !org.managerIds.includes(auth.userId)) {
      return Response.json({ error: 'Not authorized to manage requests for this organization' }, { status: 403 });
    }

    const parsed = await validateBody(request, decisionSchema);
    if (!parsed.ok) return parsed.response;
    const { status } = parsed.data;

    const joinRequest = await JoinRequestModel.findById(requestId);
    if (!joinRequest || joinRequest.organizationId !== orgId) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }
    
    if (joinRequest.status !== 'pending') {
      return Response.json({ error: 'Request is already processed' }, { status: 400 });
    }

    await JoinRequestModel.updateStatus(requestId, status);

    if (status === 'approved') {
      // Add user to org members
      const newMembers = [...new Set([...org.members, joinRequest.userId])];
      await OrganizationModel.update(org.id, { members: newMembers });
    }

    publishOrgJoinEvent(orgId, {
      type: 'join_request_removed',
      requestId,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update join request error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
