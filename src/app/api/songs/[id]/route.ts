import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { UserModel } from '@/server/models/user';
import { COLLECTIONS } from '@/server/db/collections';
import { appCache } from '@/server/cache';
import { validateBody, validateParams } from '@/server/validation/http';
import {
  boundedString,
  genreInput,
  objectId,
  songFormatEnum,
  songStatusEnum,
  SONG_TITLE_MAX,
  SONG_ARTIST_MAX,
  SONG_LANGUAGE_MAX,
  SONG_LYRICS_MAX,
} from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

const songUpdateSchema = z
  .object({
    title: boundedString(SONG_TITLE_MAX).optional(),
    artist: boundedString(SONG_ARTIST_MAX).optional(),
    language: boundedString(SONG_LANGUAGE_MAX).optional(),
    genre: genreInput.optional(),
    lyrics: z.string().max(SONG_LYRICS_MAX).optional(),
    originalKey: z.string().trim().max(20).optional(),
    externalUrl: z.union([z.literal(''), z.string().trim().url().max(2048)]).optional(),
    keywords: z.array(boundedString(50)).max(50).optional(),
    format: songFormatEnum.optional(),
    status: songStatusEnum.optional(),
    verifiedBy: objectId.optional(),
    verifiedAt: z.string().max(40).optional(),
    rejectionReason: z.string().max(1000).optional(),
    rejectionCategory: z.string().max(60).optional(),
    updatedAt: z.string().max(40).optional(),
  })
  .strict();

// GET /api/songs/[id] - Get a song by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;
    const song = await SongModel.findById(id);
    if (!song) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }
    
    let createdByName = 'Unknown';
    let verifiedByName = undefined;

    const creator = await UserModel.findById(song.createdBy);
    if (creator) {
      createdByName = creator.displayName || creator.name || 'Unknown';
    }

    if (song.verifiedBy) {
      const verifier = await UserModel.findById(song.verifiedBy);
      if (verifier) {
        verifiedByName = verifier.displayName || verifier.name || 'Unknown';
      }
    }

    return new Response(JSON.stringify({ 
      song: {
        ...song,
        createdByName,
        verifiedByName
      } 
    }), {
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

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

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

    const parsed = await validateBody(request, songUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const updates = parsed.data;

    const song = await SongModel.update(id, updates as Parameters<typeof SongModel.update>[1]);
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

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

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
