import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';
import { UserModel } from '@/server/models/user';
import { hasAnyRole } from '@/lib/roles';
import { validateQuery } from '@/server/validation/http';
import { compressedJson } from '@/server/compress';

const searchQuerySchema = z
  .object({
    q: z.string().max(200).optional(),
    ids: z.string().max(2000).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

// GET /api/songs/search?q=  or  ?ids=id1,id2
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const dbUser = await UserModel.findById(auth.userId);
    if (!hasAnyRole(dbUser || auth, 'editor', 'verifier')) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const queryCheck = validateQuery(request, searchQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const idsParam = searchParams.get('ids') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10) || 25, 50);

    if (idsParam.trim()) {
      const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
      const songs = await SongModel.findByIdsLite(ids);
      return compressedJson(request, { songs });
    }

    if (q.trim().length < 1) {
      return Response.json({ songs: [] });
    }

    const songs = await SongModel.searchLibrary(q, limit);
    return compressedJson(request, { songs });
  } catch (error) {
    console.error('Library search error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
