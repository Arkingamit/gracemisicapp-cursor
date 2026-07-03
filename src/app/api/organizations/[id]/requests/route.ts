import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/backend/models/organization';
import { JoinRequestModel } from '@/backend/models/joinRequest';
import { getAuthUser, authError } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const org = await OrganizationModel.findById(params.id);
    if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });

    // Only managers and super admins can view requests
    if (auth.role !== 'super_admin' && !org.managerIds.includes(auth.userId)) {
      return Response.json({ error: 'Not authorized to view requests for this organization' }, { status: 403 });
    }

    const requests = await JoinRequestModel.getPendingByOrganization(params.id);
    return Response.json({ requests });
  } catch (error) {
    console.error('Get join requests error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
