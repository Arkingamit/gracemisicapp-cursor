
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { FavoriteModel } from '@/server/models/favorite';
import { getAuthUser, authError } from '@/lib/auth';
import { enforceRateLimit } from '@/server/rateLimit';
import { validateBody } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const favoriteSchema = z.object({ songId: objectId }).strict();

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

    const limited = await enforceRateLimit(request, {
      policy: 'authenticated',
      bucket: 'favorites-toggle',
      identifier: auth.userId,
    });
    if (limited) return limited;

    const parsed = await validateBody(request, favoriteSchema);
    if (!parsed.ok) return parsed.response;
    const { songId } = parsed.data;

    const result = await FavoriteModel.toggleLike(auth.userId, songId);
    return Response.json(result);
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

