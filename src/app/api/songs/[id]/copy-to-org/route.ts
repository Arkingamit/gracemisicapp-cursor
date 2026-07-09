import { NextResponse, NextRequest } from 'next/server';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { OrganizationModel } from '@/server/models/organization';
import { SettingsModel } from '@/server/models/settings';
import { AuditLogModel } from '@/server/models/auditLog';
import { appCache } from '@/server/cache';

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
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Verify the song exists
    const existingSong = await SongModel.findById(id);
    if (!existingSong) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    // Verify user is a manager of the target organization (or super_admin)
    const { ObjectId } = await import('mongodb');
    const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
    const org = await orgCollection.findOne({ _id: new ObjectId(organizationId) });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const isManagerOfOrg = org.managerIds?.includes(auth.userId) || org.createdBy === auth.userId;
    const isSuperAdmin = auth.role === 'super_admin';

    if (!isManagerOfOrg && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only organization managers can add songs to their private library' },
        { status: 403 }
      );
    }

    // Check org song limit
    const orgModel = await OrganizationModel.findById(organizationId);
    const settings = await SettingsModel.getSettings();
    const limit = orgModel?.maxCustomSongsLimit ?? settings.max_custom_songs_per_org;
    const songsCollection = await getCollection(COLLECTIONS.SONGS);
    const orgSongCount = await songsCollection.countDocuments({ organizationId });

    if (limit && limit > 0 && orgSongCount >= limit) {
      return NextResponse.json(
        { error: `This organization has reached the maximum limit of ${limit} custom songs.` },
        { status: 403 }
      );
    }

    const copiedSong = await SongModel.copyToOrg(id, organizationId, auth.userId);

    // Invalidate song caches
    appCache.invalidate('songs:');

    // Log the action
    if (copiedSong) {
      await AuditLogModel.log({
        collectionName: COLLECTIONS.SONGS,
        documentId: copiedSong.id,
        action: 'create',
        userId: auth.userId,
        itemName: `${copiedSong.title} — ${copiedSong.artist} (copied to org)`,
      });
    }

    return NextResponse.json({
      message: 'Song successfully copied to your organization library',
      song: copiedSong
    });
  } catch (error) {
    console.error('Error copying song to org:', error);
    return NextResponse.json(
      { error: 'Failed to copy song to organization' },
      { status: 500 }
    );
  }
}
