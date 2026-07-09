
import { NextRequest } from 'next/server';
import { PlaylistModel } from '@/server/models/playlist';
import { getAuthUser, authError } from '@/lib/auth';

// GET /api/playlists - List current user's playlists
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const playlists = await PlaylistModel.listByUser(auth.userId);
    return Response.json({ playlists });
  } catch (error) {
    console.error('List playlists error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/playlists - Create a new playlist
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const body = await request.json();
    if (!body.name || body.name.trim() === '') {
      return Response.json({ error: 'Playlist name is required' }, { status: 400 });
    }

    // Check system limits
    const { SettingsModel } = await import('@/server/models/settings');
    const settings = await SettingsModel.getSettings();
    
    if (settings.max_collections_per_user && settings.max_collections_per_user > 0) {
      const userPlaylists = await PlaylistModel.listByUser(auth.userId);
      if (userPlaylists.length >= settings.max_collections_per_user) {
        return Response.json(
          { error: `Maximum limit of ${settings.max_collections_per_user} collections per user reached.` },
          { status: 403 }
        );
      }
    }

    if (settings.max_songs_per_collection && settings.max_songs_per_collection > 0) {
      if (body.songs && body.songs.length > settings.max_songs_per_collection) {
        return Response.json(
          { error: `Maximum limit of ${settings.max_songs_per_collection} songs per collection exceeded.` },
          { status: 400 }
        );
      }
    }

    const playlist = await PlaylistModel.create({
      name: body.name.trim(),
      userId: auth.userId,
      songs: body.songs || []
    });

    return Response.json({ playlist }, { status: 201 });
  } catch (error) {
    console.error('Create playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

