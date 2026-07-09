import { NextRequest } from 'next/server';
import { GroupModel } from '@/server/models/group';
import { OrganizationModel } from '@/server/models/organization';
import { SongModel } from '@/server/models/song';
import { SettingsModel } from '@/server/models/settings';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';

// POST /api/groups/[id]/songs - Add a song to the group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const { id } = await params;
    const { songId } = await request.json();

    // Check permissions: only org editors, managers, or super_admin
    const group = await GroupModel.findById(id);
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    const org = await OrganizationModel.findById(group.organizationId);
    const isSuperAdmin = auth.role === 'super_admin';
    const isOrgManager = org?.managerIds?.includes(auth.userId) ?? false;
    const isOrgEditor = (org?.editorIds || []).includes(auth.userId);

    if (!isSuperAdmin && !isOrgManager && !isOrgEditor) {
      return Response.json(
        { error: 'Only editors or managers can add songs to a song set' },
        { status: 403 }
      );
    }

    if (!isSuperAdmin) {
      const settings = await SettingsModel.getSettings();
      const limit = org?.maxSongsPerGroupLimit ?? settings.max_songs_per_group;
      if (limit && limit > 0) {
        if ((group.songs || []).length >= limit) {
          return Response.json(
            { error: `This song set has reached the maximum limit of ${limit} songs.` },
            { status: 403 }
          );
        }
      }
    }

    const updatedGroup = await GroupModel.addSong(id, songId);
    if (!updatedGroup) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // Audit log: Song added to Song Set
    let songName = songId;
    try {
      const song = await SongModel.findById(songId);
      if (song) songName = `${song.title} — ${song.artist}`;
    } catch (e) {}
    await AuditLogModel.log({
      collectionName: COLLECTIONS.GROUPS,
      documentId: id,
      action: 'update',
      userId: auth.userId,
      itemName: `Added "${songName}" to ${group.name}`,
    });

    return Response.json({ group: updatedGroup });
  } catch (error) {
    console.error('Add song to group error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/groups/[id]/songs - Remove a song from the group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const { id } = await params;
    const { songId } = await request.json();

    // Check permissions: only org editors, managers, or super_admin
    const group = await GroupModel.findById(id);
    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    const org = await OrganizationModel.findById(group.organizationId);
    const isSuperAdmin = auth.role === 'super_admin';
    const isOrgManager = org?.managerIds?.includes(auth.userId) ?? false;
    const isOrgEditor = (org?.editorIds || []).includes(auth.userId);

    if (!isSuperAdmin && !isOrgManager && !isOrgEditor) {
      return Response.json(
        { error: 'Only editors or managers can remove songs from a song set' },
        { status: 403 }
      );
    }

    const updatedGroup = await GroupModel.removeSong(id, songId);
    if (!updatedGroup) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // Audit log: Song removed from Song Set
    let songName = songId;
    try {
      const song = await SongModel.findById(songId);
      if (song) songName = `${song.title} — ${song.artist}`;
    } catch (e) {}
    await AuditLogModel.log({
      collectionName: COLLECTIONS.GROUPS,
      documentId: id,
      action: 'update',
      userId: auth.userId,
      itemName: `Removed "${songName}" from ${group.name}`,
    });

    return Response.json({ group: updatedGroup });
  } catch (error) {
    console.error('Remove song from group error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

