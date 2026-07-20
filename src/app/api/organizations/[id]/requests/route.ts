import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { JoinRequestModel } from '@/server/models/joinRequest';
import { getAuthUser, authError } from '@/lib/auth';
import { validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const org = await OrganizationModel.findById(id);
    if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });

    // Only managers and super admins can view requests
    if (auth.role !== 'super_admin' && !org.managerIds.includes(auth.userId)) {
      return Response.json({ error: 'Not authorized to view requests for this organization' }, { status: 403 });
    }

    const requests = await JoinRequestModel.getPendingByOrganization(id);
    return Response.json({ requests });
  } catch (error) {
    console.error('Get join requests error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
