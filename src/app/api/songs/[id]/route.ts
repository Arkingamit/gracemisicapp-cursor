import { NextRequest } from 'next/server';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { UserModel } from '@/server/models/user';
import { COLLECTIONS } from '@/server/db/collections';
import { appCache } from '@/server/cache';

// GET /api/songs/[id] - Get a song by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const song = await SongModel.findById(id);
    if (!song) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }
    return new Response(JSON.stringify({ song }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Get song error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/songs/[id] - Update a song
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const { id } = await params;

    // Fetch existing song to check ownership
    const existingSong = await SongModel.findById(id);
    if (!existingSong) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }

    // Get fresh user data from DB since JWT might have a stale role
    const dbUser = await UserModel.findById(auth.userId);
    const actualRole = dbUser?.role || auth.role;

    // Role check: super_admin and editor can update any song.
    // Manager can only update their own songs.
    const isSuperAdmin = actualRole === 'super_admin';
    const isEditor = actualRole === 'editor';
    const isOwner = existingSong.createdBy === auth.userId;
    const isManager = actualRole === 'manager';

    if (!isSuperAdmin && !isEditor && !(isManager && isOwner)) {
      return Response.json(
        { error: 'You do not have permission to update this song' },
        { status: 403 }
      );
    }

    const updates = await request.json();
    const song = await SongModel.update(id, updates);
    if (!song) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }

    // Log the update
    await AuditLogModel.log({
      collectionName: COLLECTIONS.SONGS,
      documentId: id,
      action: 'update',
      userId: auth.userId,
      itemName: `${existingSong.title} — ${existingSong.artist}`,
      previousState: existingSong
    });

    // Invalidate cached song lists
    appCache.invalidate('songs:');

    return Response.json({ song });
  } catch (error) {
    console.error('Update song error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/songs/[id] - Delete a song
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

    // Fetch existing song to check ownership
    const existingSong = await SongModel.findById(id);
    if (!existingSong) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }

    // Get fresh user data from DB since JWT might have a stale role
    const dbUser = await UserModel.findById(auth.userId);
    const actualRole = dbUser?.role || auth.role;

    // Role check: super_admin and editor can delete any song.
    // Manager can only delete their own songs.
    const isSuperAdmin = actualRole === 'super_admin';
    const isEditor = actualRole === 'editor';
    const isOwner = existingSong.createdBy === auth.userId;
    const isManager = actualRole === 'manager';

    if (!isSuperAdmin && !isEditor && !(isManager && isOwner)) {
      return Response.json(
        { error: 'You do not have permission to delete this song' },
        { status: 403 }
      );
    }

    const success = await SongModel.delete(id);
    if (!success) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }

    // Log the deletion
    await AuditLogModel.log({
      collectionName: COLLECTIONS.SONGS,
      documentId: id,
      action: 'delete',
      userId: auth.userId,
      itemName: `${existingSong.title} — ${existingSong.artist}`,
      previousState: existingSong
    });

    // Invalidate cached song lists
    appCache.invalidate('songs:');

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete song error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
