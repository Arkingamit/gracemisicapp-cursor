
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PlaylistModel } from '@/server/models/playlist';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody, validateParams, validateQuery } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const songIdBodySchema = z.object({ songId: objectId }).strict();
const songIdQuerySchema = z.object({ songId: objectId }).strict();

// POST /api/playlists/[id]/songs - Add a song to a playlist
export async function POST(
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

    const parsed = await validateBody(request, songIdBodySchema);
    if (!parsed.ok) return parsed.response;
    const { songId } = parsed.data;

    const playlist = await PlaylistModel.findById(id);
    if (!playlist) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.userId !== auth.userId) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check system limits
    const { SettingsModel } = await import('@/server/models/settings');
    const settings = await SettingsModel.getSettings();
    if (settings.max_songs_per_collection && settings.max_songs_per_collection > 0) {
      if (playlist.songs && playlist.songs.length >= settings.max_songs_per_collection) {
        return Response.json(
          { error: `Maximum limit of ${settings.max_songs_per_collection} songs per collection reached.` },
          { status: 403 }
        );
      }
    }

    await PlaylistModel.addSong(id, songId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Add song to playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/playlists/[id]/songs - Remove a song from a playlist
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

    const queryCheck = validateQuery(request, songIdQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;
    const { songId } = queryCheck.data;

    const playlist = await PlaylistModel.findById(id);
    if (!playlist) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.userId !== auth.userId) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    await PlaylistModel.removeSong(id, songId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Remove song from playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
