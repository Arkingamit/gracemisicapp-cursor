import { NextRequest } from 'next/server';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser } from '@/lib/auth';

// GET /api/organizations/[id]/song-stats — Get aggregated song stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationModel.findById(id);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only managers, editors, and super_admin can view stats
    const isManager = org.managerIds.includes(auth.userId);
    const isEditor = (org.editorIds || []).includes(auth.userId);
    const isSuperAdmin = auth.role === 'super_admin';

    if (!isManager && !isEditor && !isSuperAdmin) {
      return Response.json({ error: 'Forbidden: Manager or Editor access required' }, { status: 403 });
    }

    const stats = await GroupModel.getSongStats(id);

    return Response.json(stats);
  } catch (error) {
    console.error('Get song stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
