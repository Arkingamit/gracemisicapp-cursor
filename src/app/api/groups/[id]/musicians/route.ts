import { NextRequest } from 'next/server';
import { z } from 'zod';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';
import { getAuthUser } from '@/lib/auth';
// GET /api/groups/[id]/musicians — Get musician assignments for a group
import { sendNotificationToUser } from '@/server/utils/pushNotifications';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, musicianAssignment } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const assignmentsBodySchema = z
  .object({ assignments: z.array(musicianAssignment).max(1000) })
  .strict();

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

    const group = await GroupModel.findById(id);
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    const assignments = group.musicianAssignments || [];

    // Resolve display names so clients never have to show raw user IDs
    const uniqueUserIds = [...new Set(assignments.map(a => a.userId))];
    const nameEntries = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const user = await UserModel.findById(userId);
        return [userId, user ? (user.name || user.username || user.email) : null] as const;
      })
    );
    const nameMap = Object.fromEntries(nameEntries);

    const enriched = assignments.map(a => ({
      ...a,
      userName: nameMap[a.userId] || null,
    }));

    return Response.json({ assignments: enriched });
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
    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;
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
    const isOwner = group.createdBy === auth.userId;

    if (!isManager && !isEditor && !isSuperAdmin && !isOwner) {
      return Response.json({ error: 'Forbidden: Manager, Editor, or set owner access required' }, { status: 403 });
    }

    const parsed = await validateBody(request, assignmentsBodySchema);
    if (!parsed.ok) return parsed.response;
    const { assignments } = parsed.data;

    
    // Compare old vs new assignments to notify newly assigned users
    const oldAssignments = group.musicianAssignments || [];
    const newAssignments = assignments;
    
    const oldUserIds = new Set(oldAssignments.map(a => a.userId));
    
    const updatedGroup = await GroupModel.updateMusicianAssignments(
      id,
      assignments as Parameters<typeof GroupModel.updateMusicianAssignments>[1]
    );

    // Send notifications after successful update
    for (const assignment of newAssignments) {
      if (!oldUserIds.has(assignment.userId) && assignment.userId !== auth.userId) {
        await sendNotificationToUser(
          assignment.userId,
          'New Song Set Assignment',
          `You have been assigned to play ${assignment.instrument} in "${group.name}".`,
          `/organizations/view?id=${group.organizationId}&tab=song-sets&groupId=${group.id}`
        );
      }
    }

    return Response.json({ group: updatedGroup });
  } catch (error) {
    console.error('Update musician assignments error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
