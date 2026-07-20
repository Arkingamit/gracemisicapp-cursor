import { NextRequest } from 'next/server';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { UserModel } from '@/server/models/user';
import { appCache } from '@/server/cache';
import { compressedJson } from '@/server/compress';
import { enforceRateLimit } from '@/server/rateLimit';

// GET /api/contributors - Get top contributors leaderboard
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, { policy: 'public', bucket: 'contributors' });
    if (limited) return limited;

    const cacheKey = 'top_contributors';
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

  // Aggregate songs by createdBy where status is approved and organizationId is global
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

  // Fetch user details for each contributor
  return Promise.all(results.map(async (r: any) => {
    const user = await UserModel.findById(r._id);
    return {
      id: r._id,
      name: user ? (user.displayName || user.name || 'Unknown User') : 'Unknown User',
      count: r.count
    };
  }));
}
