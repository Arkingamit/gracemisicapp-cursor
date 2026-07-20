import { NextRequest } from 'next/server';
import { z } from 'zod';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';
import { getAuthUser } from '@/lib/auth';
import { validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

// GET /api/organizations/[id]/musician-stats — Get aggregated musician stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationModel.findById(id);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Determine access based on visibility setting
    const isManager = org.managerIds.includes(auth.userId);
    const isEditor = (org.editorIds || []).includes(auth.userId);
    const isSuperAdmin = auth.role === 'super_admin';
    const isMember = org.members.includes(auth.userId);

    const visibility = org.musicianStatsVisibility || 'all';
    
    let hasAccess = false;
    if (isSuperAdmin || isManager) {
      hasAccess = true;
    } else if (visibility === 'all' && isMember) {
      hasAccess = true;
    } else if (visibility === 'editors' && isEditor) {
      hasAccess = true;
    }

    if (!hasAccess) {
      return Response.json({ error: 'Forbidden: You do not have access to view musician stats' }, { status: 403 });
    }

    const stats = await GroupModel.getMusicianStats(id);

    // Enrich with user names
    const enrichedMembers = await Promise.all(
      stats.members.map(async (m) => {
        const user = await UserModel.findById(m.userId);
        return {
          ...m,
          userName: user?.name || user?.displayName || 'Unknown User',
          userEmail: user?.email || ''
        };
      })
    );

    return Response.json({ members: enrichedMembers });
  } catch (error) {
    console.error('Get musician stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
