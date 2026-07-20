import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, authError } from '@/lib/auth';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { SongModel } from '@/server/models/song';
import { SettingsModel } from '@/server/models/settings';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';
import { validateBody } from '@/server/validation/http';
import { objectId, objectIdArray } from '@/server/validation/schemas';

const addSongsSchema = z
  .object({ groupId: objectId, songIds: objectIdArray.min(1).max(2000) })
  .strict();

/** POST /api/ai/song-set/songs — add verified songs to a set (creator or org member) */
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const parsed = await validateBody(req, addSongsSchema);
    if (!parsed.ok) return parsed.response;
    const { groupId, songIds } = parsed.data;

    const group = await GroupModel.findById(groupId);
    if (!group) {
      return Response.json({ error: 'Song set not found' }, { status: 404 });
    }

    const org = await OrganizationModel.findById(group.organizationId);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    const isSuperAdmin = auth.role === 'super_admin';
    const isManager = org.managerIds?.includes(auth.userId) ?? false;
    const isEditor = (org.editorIds || []).includes(auth.userId);
    const isMember = (org.members || []).includes(auth.userId);
    const isCreator = group.createdBy === auth.userId;

    if (!isSuperAdmin && !isManager && !isEditor && !isMember && !isCreator) {
      return Response.json(
        { error: 'You do not have permission to add songs to this song set' },
        { status: 403 }
      );
    }

    const settings = await SettingsModel.getSettings();
    const limit = org.maxSongsPerGroupLimit ?? settings.max_songs_per_group;
    const existing = new Set(group.songs || []);

    // Validate all candidates with one $in query, then apply the size limit
    // and add everything with a single batched update.
    const newIds = songIds.filter((id) => !existing.has(id));
    const candidates = await SongModel.findByIdsLite(newIds);
    const room =
      !isSuperAdmin && limit && limit > 0
        ? Math.max(0, limit - existing.size)
        : candidates.length;
    const added = candidates
      .slice(0, room)
      .map((s) => ({ id: s.id, title: s.title }));

    if (added.length > 0) {
      await GroupModel.addSongs(groupId, added.map((s) => s.id));
    }

    if (added.length > 0) {
      await AuditLogModel.log({
        collectionName: COLLECTIONS.GROUPS,
        documentId: groupId,
        action: 'update',
        userId: auth.userId,
        itemName: `Added ${added.length} song(s) to ${group.name} via AI`,
      });
    }

    const updated = await GroupModel.findById(groupId);
    // One $in query for all titles instead of a findById per song
    const songTitles = (await SongModel.findByIdsLite(updated?.songs || [])).map(
      (s) => ({ id: s.id, title: s.title })
    );

    return Response.json({
      added,
      group: {
        id: groupId,
        name: group.name,
        songs: songTitles,
        link: `/groups/view?id=${groupId}`,
      },
    });
  } catch (error) {
    console.error('AI add songs to set error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
