import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    // Must be super_admin or editor to view all contributions
    if (auth.role !== 'super_admin' && auth.role !== 'editor') {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 });
    }

    const songsCollection = await getCollection(COLLECTIONS.SONGS);
    const usersCollection = await getCollection(COLLECTIONS.USERS);

    // Fetch all users to map IDs to names
    const users = await usersCollection.find({}).toArray();
    const userMap = new Map<string, any>();
    users.forEach(u => {
      userMap.set(u._id.toString(), {
        name: u.name || u.displayName || 'Unknown',
        email: u.email || '',
      });
    });

    // Fetch all approved songs
    const songs = await songsCollection.find({ status: 'approved' }, {
      projection: {
        title: 1,
        createdBy: 1,
        status: 1,
        verifiedBy: 1,
        createdAt: 1
      }
    }).toArray();

    // Group songs by createdBy
    const contributionsMap = new Map<string, any>();

    songs.forEach(song => {
      const creatorId = song.createdBy;
      if (!creatorId) return; // Skip if no creator

      if (!contributionsMap.has(creatorId)) {
        const creatorInfo = userMap.get(creatorId) || { name: 'Unknown User', email: '' };
        contributionsMap.set(creatorId, {
          userId: creatorId,
          userName: creatorInfo.name,
          userEmail: creatorInfo.email,
          totalSongs: 0,
          songs: []
        });
      }

      const contributorData = contributionsMap.get(creatorId);
      contributorData.totalSongs += 1;
      
      const verifierInfo = song.verifiedBy ? userMap.get(song.verifiedBy) : null;

      contributorData.songs.push({
        id: song._id.toString(),
        title: song.title,
        status: song.status || 'approved',
        verifiedByName: verifierInfo ? verifierInfo.name : null,
        createdAt: song.createdAt
      });
    });

    // Sort songs by date descending for each user
    contributionsMap.forEach(contributor => {
      contributor.songs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    // Convert map to array and sort by total songs descending
    const contributions = Array.from(contributionsMap.values()).sort((a, b) => b.totalSongs - a.totalSongs);

    return new Response(JSON.stringify({ contributions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List contributions error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
