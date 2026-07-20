export const dynamic = 'force-dynamic';
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

    if (auth.role !== 'super_admin' && auth.role !== 'editor') {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 });
    }

    const songsCollection = await getCollection(COLLECTIONS.SONGS);
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const auditCollection = await getCollection(COLLECTIONS.AUDIT_LOGS);

    // Build user map
    const users = await usersCollection.find({}).toArray();
    const userMap = new Map<string, { name: string; email: string }>();
    users.forEach(u => {
      userMap.set(u._id.toString(), {
        name: u.name || u.displayName || 'Unknown',
        email: u.email || '',
      });
    });

    // Find all approved songs that have aliases (or legacy songs with no status)
    const songsWithAliases = await songsCollection.find(
      { 
        $or: [{ status: 'approved' }, { status: { $exists: false } }, { status: null }],
        aliases: { $exists: true, $ne: [] } 
      },
      { projection: { title: 1, artist: 1, aliases: 1, createdAt: 1 } }
    ).toArray();

    // Find all rejected songs that were rejected as alias duplicates
    const rejectedAsDuplicates = await songsCollection.find(
      { status: 'rejected', rejectionReason: { $regex: 'added as alias', $options: 'i' } },
      { projection: { title: 1, createdBy: 1, verifiedBy: 1, verifiedAt: 1, rejectionReason: 1, createdAt: 1 } }
    ).toArray();

    // Fetch add_alias audit logs for verifier info
    const aliasAuditLogs = await auditCollection.find(
      { action: 'add_alias' },
      { projection: { documentId: 1, userId: 1, itemName: 1, timestamp: 1, createdAt: 1 } }
    ).toArray();

    // Build a map: alias title -> { submittedBy, verifiedBy, verifiedAt, submittedAt }
    const aliasMetaMap = new Map<string, {
      aliasTitle: string;
      submittedByUserId: string;
      submittedByName: string;
      verifiedByUserId: string;
      verifiedByName: string;
      verifiedAt: string | null;
      submittedAt: string | null;
    }>();

    rejectedAsDuplicates.forEach(rejSong => {
      const aliasTitle = rejSong.title?.trim()?.toLowerCase();
      if (aliasTitle) {
        const createdByStr = rejSong.createdBy ? rejSong.createdBy.toString() : '';
        const verifiedByStr = rejSong.verifiedBy ? rejSong.verifiedBy.toString() : '';
        
        const submitter = userMap.get(createdByStr) || { name: 'Unknown', email: '' };
        const verifier = verifiedByStr ? (userMap.get(verifiedByStr) || { name: 'Unknown', email: '' }) : { name: 'Unknown', email: '' };
        
        aliasMetaMap.set(aliasTitle, {
          aliasTitle: rejSong.title,
          submittedByUserId: createdByStr,
          submittedByName: submitter.name,
          submittedByEmail: submitter.email,
          verifiedByUserId: verifiedByStr,
          verifiedByName: verifier.name,
          verifiedByEmail: verifier.email,
          verifiedAt: rejSong.verifiedAt?.toISOString?.() || rejSong.verifiedAt || null,
          submittedAt: rejSong.createdAt?.toISOString?.() || rejSong.createdAt || null,
        });
      }
    });

    // Also check audit logs for verifier info if not found from rejected songs
    aliasAuditLogs.forEach(log => {
      const match = log.itemName?.match(/Alias "(.+?)" added to/i);
      if (match) {
        const aliasTitle = match[1].trim().toLowerCase();
        if (!aliasMetaMap.has(aliasTitle)) {
          const userIdStr = log.userId ? log.userId.toString() : '';
          const verifier = userMap.get(userIdStr) || { name: 'Unknown', email: '' };
          aliasMetaMap.set(aliasTitle, {
            aliasTitle: match[1],
            submittedByUserId: '',
            submittedByName: 'Unknown',
            submittedByEmail: '',
            verifiedByUserId: userIdStr,
            verifiedByName: verifier.name,
            verifiedByEmail: verifier.email,
            verifiedAt: log.timestamp?.toISOString?.() || log.createdAt?.toISOString?.() || null,
            submittedAt: null,
          });
        }
      }
    });

    // Build the response
    const songsData = songsWithAliases.map(song => {
      const aliases = (song.aliases || []).map((alias: string) => {
        const meta = aliasMetaMap.get(alias.trim().toLowerCase());
        return {
          title: alias,
          submittedByName: meta?.submittedByName || 'Unknown',
          submittedByEmail: meta?.submittedByEmail || '',
          submittedByUserId: meta?.submittedByUserId || 'N/A',
          verifiedByName: meta?.verifiedByName || 'Unknown',
          verifiedByEmail: meta?.verifiedByEmail || '',
          verifiedByUserId: meta?.verifiedByUserId || 'N/A',
          verifiedAt: meta?.verifiedAt || null,
          submittedAt: meta?.submittedAt || null,
        };
      });

      return {
        songId: song._id.toString(),
        songTitle: song.title,
        songArtist: song.artist || 'Unknown Artist',
        aliasCount: aliases.length,
        aliases,
      };
    });

    // Sort by alias count descending
    songsData.sort((a: any, b: any) => b.aliasCount - a.aliasCount);

    // Summary stats
    const totalSongsWithAliases = songsData.length;
    const totalAliases = songsData.reduce((sum: number, s: any) => sum + s.aliasCount, 0);

    return new Response(JSON.stringify({
      totalSongsWithAliases,
      totalAliases,
      songs: songsData,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List aliases error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
