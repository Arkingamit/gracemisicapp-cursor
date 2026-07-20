import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { generateKeywords } from '@/lib/keywords';
import { getAuthUser } from '@/lib/auth';
import { validateQuery } from '@/server/validation/http';

const keywordsQuerySchema = z.object({ secret: z.string().max(100).optional() }).strict();

export async function GET(req: NextRequest) {
  try {
    // Auth: super_admin session (cookie/bearer), or MIGRATION_SECRET env var for CLI use.
    const queryCheck = validateQuery(req, keywordsQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;
    const secret = queryCheck.data.secret;
    const auth = getAuthUser(req);
    const secretOk =
      !!process.env.MIGRATION_SECRET && secret === process.env.MIGRATION_SECRET;
    if (auth?.role !== 'super_admin' && !secretOk) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const collection = await getCollection(COLLECTIONS.SONGS);
    
    // Find songs that have lyrics
    const songsToUpdate = await collection.find({ lyrics: { $exists: true, $ne: '' } }).toArray();

    // Batch all updates into chunked bulkWrites: one round trip per chunk
    // instead of one per song, and chunking keeps individual batches (and
    // their lock time) bounded.
    const CHUNK_SIZE = 500;
    const operations = songsToUpdate
      .filter((song) => song.lyrics)
      .map((song) => ({
        updateOne: {
          filter: { _id: song._id },
          update: { $set: { keywords: generateKeywords(song.lyrics) } },
        },
      }));

    let updatedCount = 0;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const result = await collection.bulkWrite(chunk, { ordered: false });
      updatedCount += result.matchedCount;
    }

    return Response.json({
      success: true,
      message: `Successfully generated and saved keywords for ${updatedCount} songs.`,
    });
  } catch (error) {
    console.error('Migration Error:', error);
    return Response.json(
      { error: 'Internal server error during migration' },
      { status: 500 }
    );
  }
}

