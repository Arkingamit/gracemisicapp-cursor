
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PlaylistModel } from '@/server/models/playlist';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, boundedString, NAME_MAX } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const playlistPatchSchema = z.object({ name: boundedString(NAME_MAX).optional() }).strict();

// GET /api/playlists/[id] - Get a specific playlist
export async function GET(
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
    const playlist = await PlaylistModel.findById(id);

    if (!playlist) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // Only owner can see their private playlist
    if (playlist.userId !== auth.userId) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    return Response.json({ playlist });
  } catch (error) {
    console.error('Get playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/playlists/[id] - Update playlist name or items
export async function PATCH(
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
    const playlist = await PlaylistModel.findById(id);

    if (!playlist) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.userId !== auth.userId) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const parsed = await validateBody(request, playlistPatchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Simple update for now (name)
    if (body.name) {
      const updated = await PlaylistModel.update(id, body.name.trim());
      return Response.json({ playlist: updated });
    }

    return Response.json({ playlist });
  } catch (error) {
    console.error('Update playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/playlists/[id] - Delete a playlist
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
    const playlist = await PlaylistModel.findById(id);

    if (!playlist) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.userId !== auth.userId) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    await PlaylistModel.delete(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
