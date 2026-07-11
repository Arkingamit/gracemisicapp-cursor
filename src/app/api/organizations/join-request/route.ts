import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/server/models/organization';
import { JoinRequestModel } from '@/server/models/joinRequest';
import { getAuthUser, authError } from '@/lib/auth';
import { sendNotificationToUser } from '@/server/utils/pushNotifications';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const { joinCode } = await request.json();
    if (!joinCode || typeof joinCode !== 'string') {
      return Response.json({ error: 'Join code is required' }, { status: 400 });
    }

    const org = await OrganizationModel.findByJoinCode(joinCode);
    if (!org) {
      return Response.json({ error: 'Invalid join code or organization not found' }, { status: 404 });
    }

    if (org.members.includes(auth.userId)) {
      return Response.json({ error: 'You are already a member of this organization' }, { status: 400 });
    }

    try {
      const joinRequest = await JoinRequestModel.create(org.id, auth.userId);
      
      // Notify managers about the new request
      const managerIds = org.managerIds || [];
      const userEmail = auth.email || 'A user';
      for (const managerId of managerIds) {
        if (managerId !== auth.userId) {
          await sendNotificationToUser(
            managerId,
            'New Join Request',
            `${userEmail} has requested to join "${org.name}".`,
            `/organizations/view?id=${org.id}&tab=requests`
          );
        }
      }

      return Response.json({ joinRequest }, { status: 201 });
    } catch (e: any) {
      return Response.json({ error: e.message || 'Failed to submit request' }, { status: 400 });
    }
  } catch (error) {
    console.error('Submit join request error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

