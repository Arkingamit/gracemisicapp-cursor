import { NextRequest } from 'next/server';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser, authError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const stats = await GroupModel.getUserStats(auth.userId);

    // Enrich with organization names
    const enrichedOrganizations = await Promise.all(
      stats.organizations.map(async (orgStat) => {
        const org = await OrganizationModel.findById(orgStat.organizationId);
        return {
          ...orgStat,
          organizationName: org?.name || 'Unknown Organization',
        };
      })
    );

    return Response.json({ organizations: enrichedOrganizations });
  } catch (error) {
    console.error('Get user stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
