import { NextRequest } from 'next/server';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { getAuthUser } from '@/lib/auth';

// GET /api/groups/[id]/musicians — Get musician assignments for a group
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

    const group = await GroupModel.findById(id);
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    return Response.json({ assignments: group.musicianAssignments || [] });
  } catch (error) {
    console.error('Get musician assignments error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/groups/[id]/musicians — Update musician assignments for a group
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const group = await GroupModel.findById(id);
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if user is manager or editor of the organization
    const org = await OrganizationModel.findById(group.organizationId);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    const isManager = org.managerIds.includes(auth.userId);
    const isEditor = (org.editorIds || []).includes(auth.userId);
    const isSuperAdmin = auth.role === 'super_admin';

    if (!isManager && !isEditor && !isSuperAdmin) {
      return Response.json({ error: 'Forbidden: Manager or Editor access required' }, { status: 403 });
    }

    const body = await request.json();
    const { assignments } = body;

    if (!Array.isArray(assignments)) {
      return Response.json({ error: 'assignments must be an array' }, { status: 400 });
    }

    // Validate each assignment
    for (const a of assignments) {
      if (!a.userId || typeof a.userId !== 'string') {
        return Response.json({ error: 'Each assignment must have a userId' }, { status: 400 });
      }
      if (!a.instrument || typeof a.instrument !== 'string') {
        return Response.json({ error: 'Each assignment must have an instrument' }, { status: 400 });
      }
    }

    const updatedGroup = await GroupModel.updateMusicianAssignments(id, assignments);
    return Response.json({ group: updatedGroup });
  } catch (error) {
    console.error('Update musician assignments error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
