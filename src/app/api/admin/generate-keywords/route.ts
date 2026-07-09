import { NextRequest } from 'next/server';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { generateKeywords } from '@/lib/keywords';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Use a simple query param for auth since browser GET requests don't send JWT headers
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== 'grace2026') {
      return Response.json({ error: 'Unauthorized. Use ?secret=grace2026' }, { status: 403 });
    }

    const collection = await getCollection(COLLECTIONS.SONGS);
    
    // Find songs that have lyrics
    const songsToUpdate = await collection.find({ lyrics: { $exists: true, $ne: '' } }).toArray();

    let updatedCount = 0;

    for (const song of songsToUpdate) {
      if (song.lyrics) {
        const keywords = generateKeywords(song.lyrics);
        await collection.updateOne(
          { _id: song._id },
          { $set: { keywords } }
        );
        updatedCount++;
      }
    }

    return Response.json({
      success: true,
      message: `Successfully generated and saved keywords for ${updatedCount} songs.`,
    });
  } catch (error: any) {
    console.error('Migration Error:', error);
    return Response.json(
      { error: error.message || 'Internal server error during migration' },
      { status: 500 }
    );
  }
}

