import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/server/models/organization';
import { JoinRequestModel } from '@/server/models/joinRequest';
import { getAuthUser, authError } from '@/lib/auth';
import { sendNotificationToUsers } from '@/server/utils/pushNotifications';
import { publishOrgJoinEvent } from '@/server/realtime/orgJoinBus';
import { enforceRateLimit } from '@/server/rateLimit';
import { z } from 'zod';
import { validateBody } from '@/server/validation/http';

const joinRequestSchema = z
  .object({ joinCode: z.string().trim().min(1).max(20) })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    // Join-code submission can be used to enumerate codes — keep it tight.
    const limited = await enforceRateLimit(request, {
      policy: 'sensitive',
      bucket: 'org-join-request',
      identifier: auth.userId,
    });
    if (limited) return limited;

    const parsed = await validateBody(request, joinRequestSchema);
    if (!parsed.ok) return parsed.response;
    const { joinCode } = parsed.data;

    const org = await OrganizationModel.findByJoinCode(joinCode);
    if (!org) {
      return Response.json({ error: 'Invalid join code or organization not found' }, { status: 404 });
    }

    if (org.members.includes(auth.userId)) {
      return Response.json({ error: 'You are already a member of this organization' }, { status: 400 });
    }

    try {
      const joinRequest = await JoinRequestModel.create(org.id, auth.userId);

      // Push live update to managers currently viewing this org
      publishOrgJoinEvent(org.id, { type: 'join_request', request: joinRequest });
      
      // Notify managers about the new request (one batched insert)
      const userEmail = auth.email || 'A user';
      const managerRecipients = (org.managerIds || []).filter((id) => id !== auth.userId);
      await sendNotificationToUsers(
        managerRecipients,
        'New Join Request',
        `${userEmail} has requested to join "${org.name}".`,
        `/organizations/view?id=${org.id}&tab=requests`
      );

      return Response.json({ joinRequest }, { status: 201 });
    } catch (e: any) {
      // JoinRequestModel throws user-facing messages for known cases; anything
      // else (e.g. a DB failure) must not leak raw details to the client.
      const knownMessages = [
        'You have already requested to join this organization.',
        'You are already a member of this organization.',
        'User not found',
        'Organization not found',
      ];
      if (e instanceof Error && knownMessages.includes(e.message)) {
        return Response.json({ error: e.message }, { status: 400 });
      }
      console.error('Join request creation failed:', e);
      return Response.json({ error: 'Failed to submit request' }, { status: 500 });
    }
  } catch (error) {
    console.error('Submit join request error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

