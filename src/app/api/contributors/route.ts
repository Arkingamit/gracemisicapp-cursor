import { NextRequest } from 'next/server';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { appCache } from '@/server/cache';
import { compressedJson } from '@/server/compress';
import { enforceRateLimit } from '@/server/rateLimit';

// GET /api/contributors - Top contributors leaderboard (anonymous — no user names)
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, { policy: 'public', bucket: 'contributors' });
    if (limited) return limited;

    const cacheKey = 'top_contributors_anon_v1';
    const wasCached = appCache.get(cacheKey) !== null;
    const contributors = await appCache.getOrSet(cacheKey, () => loadTopContributors(), 300);

    return compressedJson(request, { contributors }, {
      status: 200,
      headers: {
        'X-Cache': wasCached ? 'HIT' : 'MISS',
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('Get top contributors error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function loadTopContributors() {
  const songsCollection = await getCollection(COLLECTIONS.SONGS);

  const pipeline = [
    {
      $match: {
        $and: [
          {
            $or: [
              { organizationId: { $exists: false } },
              { organizationId: null },
              { organizationId: '' }
            ]
          },
          {
            $or: [
              { status: 'approved' },
              { status: { $exists: false } }
            ]
          }
        ]
      }
    },
    {
      $group: {
        _id: '$createdBy',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ];

  const results = await songsCollection.aggregate(pipeline).toArray();

  // Rank + count only — never expose contributor names or user ids
  return results.map((r: { count: number }, index: number) => ({
    id: `rank-${index + 1}`,
    count: r.count,
  }));
}
