
import { NextRequest } from 'next/server';
import { FavoriteModel } from '@/server/models/favorite';
import { getAuthUser, authError } from '@/lib/auth';

// GET /api/favorites - List current user's favorite song IDs
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const favoriteIds = await FavoriteModel.listFavoritesByUser(auth.userId);
    return Response.json({ favorites: favoriteIds });
  } catch (error) {
    console.error('List favorites error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/favorites - Toggle like on a song
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const body = await request.json();
    const { songId } = body;

    if (!songId) {
      return Response.json({ error: 'Song ID is required' }, { status: 400 });
    }

    const result = await FavoriteModel.toggleLike(auth.userId, songId);
    return Response.json(result);
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

