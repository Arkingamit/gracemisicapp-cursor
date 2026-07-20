
import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Song, SongInput, SongUpdateInput, MongoSong } from '@/lib/types';
import { detectKey } from '@/lib/keyDetection';
import { generateKeywords } from '@/lib/keywords';

export class SongModel {
  // Convert MongoDB document to application Song type
  static toSong(doc: MongoSong): Song {
    // Normalize genre: old docs have string, new docs have string[]
    // Ensure we only have non-empty stripped strings
    const rawGenre = Array.isArray(doc.genre) ? doc.genre : (doc.genre ? [doc.genre] : []);
    const genre = rawGenre
      .filter((g: any) => typeof g === 'string' && g.trim() !== '')
      .map((g: string) => g.trim());
    return {
      id: doc._id.toString(),
      title: doc.title,
      artist: doc.artist,
      genre,
      language: doc.language || 'English', // Fallback for legacy data before migration
      lyrics: doc.lyrics,
      createdBy: doc.createdBy,
      createdAt: typeof doc.createdAt?.toISOString === 'function' ? doc.createdAt.toISOString() : doc.createdAt,
      updatedAt: typeof doc.updatedAt?.toISOString === 'function' ? doc.updatedAt.toISOString() : (doc.updatedAt ?? (typeof doc.createdAt?.toISOString === 'function' ? doc.createdAt.toISOString() : doc.createdAt)),
      organizationId: doc.organizationId || undefined,
      externalUrl: doc.externalUrl || undefined,
      originalKey: doc.originalKey,
      keywords: doc.keywords,
      format: doc.format || 'auto',
      status: doc.status || 'approved', // Legacy songs are considered approved
      verifiedBy: doc.verifiedBy,
      verifiedAt: typeof doc.verifiedAt?.toISOString === 'function' ? doc.verifiedAt.toISOString() : doc.verifiedAt,
      aliases: doc.aliases || [],
    };
  }

  // Find a song by ID
  static async findById(id: string): Promise<Song | null> {
    try {
      if (!id || !ObjectId.isValid(id)) return null;
      const collection = await getCollection(COLLECTIONS.SONGS);
      const result = await collection.findOne({ _id: new ObjectId(id) });
      return result ? this.toSong(result as unknown as MongoSong) : null;
    } catch (error) {
      console.error("Error finding song by ID:", error);
      throw error;
    }
  }

  // Create a new song
  static async create(songInput: SongInput): Promise<Song> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      const now = new Date();
      
      const newSong: any = {
        title: songInput.title,
        artist: songInput.artist,
        genre: songInput.genre,
        language: songInput.language,
        lyrics: songInput.lyrics,
        format: songInput.format || 'auto',
        createdBy: songInput.createdBy,
        originalKey: songInput.originalKey === '___auto___' || !songInput.originalKey ? detectKey(songInput.lyrics || '') : songInput.originalKey,
        keywords: generateKeywords(songInput.lyrics),
        externalUrl: songInput.externalUrl,
        status: songInput.status || 'approved', // Default fallback
        createdAt: now,
        updatedAt: now
      };

      // Only set organizationId if provided (otherwise stays global)
      if (songInput.organizationId) {
        newSong.organizationId = songInput.organizationId;
      }
      
      const result = await collection.insertOne(newSong);
      return {
        id: result.insertedId.toString(),
        ...songInput,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
    } catch (error) {
      console.error("Error creating song:", error);
      throw error;
    }
  }

  // Update a song
  static async update(id: string, updates: SongUpdateInput): Promise<Song | null> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      
      // Auto-detect key if explicitly requested or if cleared
      let finalOriginalKey = updates.originalKey;
      if (finalOriginalKey === '___auto___' || finalOriginalKey === '') {
        finalOriginalKey = detectKey(updates.lyrics || '');
      } else if (finalOriginalKey === undefined) {
        // If not provided in the update payload, we don't want to overwrite the existing key in the DB.
        // We will leave finalOriginalKey as undefined, which gets omitted from the $set operator below.
        finalOriginalKey = undefined;
      }

      const updateDoc = {
        $set: {
          ...updates,
          ...(finalOriginalKey ? { originalKey: finalOriginalKey } : {}),
          ...(updates.lyrics !== undefined ? { keywords: generateKeywords(updates.lyrics) } : {}),
          updatedAt: new Date()
        }
      };
      
      await collection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      
      return await this.findById(id);
    } catch (error) {
      console.error("Error updating song:", error);
      throw error;
    }
  }

  // Make a song global (transfer from organization to global library)
  static async makeGlobal(id: string): Promise<Song | null> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $unset: { organizationId: "" },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(id);
    } catch (error) {
      console.error("Error making song global:", error);
      throw error;
    }
  }

  // Copy a song to global (duplicates it without an organization ID)
  static async copyToGlobal(id: string): Promise<Song | null> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      
      const originalSong = await collection.findOne({ _id: new ObjectId(id) });
      if (!originalSong) return null;

      const { _id, ...songWithoutId } = originalSong;
      delete songWithoutId.organizationId;
      
      songWithoutId.createdAt = new Date();
      songWithoutId.updatedAt = new Date();

      const result = await collection.insertOne(songWithoutId);
      return await this.findById(result.insertedId.toString());
    } catch (error) {
      console.error("Error copying song to global:", error);
      throw error;
    }
  }

  // Copy a song to an organization's private library
  static async copyToOrg(id: string, organizationId: string, userId: string): Promise<Song | null> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      
      const originalSong = await collection.findOne({ _id: new ObjectId(id) });
      if (!originalSong) return null;

      const { _id, ...songWithoutId } = originalSong;
      songWithoutId.organizationId = organizationId;
      songWithoutId.createdBy = userId;
      songWithoutId.createdAt = new Date();
      songWithoutId.updatedAt = new Date();

      const result = await collection.insertOne(songWithoutId);
      return await this.findById(result.insertedId.toString());
    } catch (error) {
      console.error("Error copying song to org:", error);
      throw error;
    }
  }

  // Delete a song
  static async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting song:", error);
      throw error;
    }
  }

  // List songs with pagination and filters
  static async list(
    page = 1, 
    limit = 20, 
    filters: { genre?: string, artist?: string, createdBy?: string, userOrgIds?: string[], globalLimit?: number, orgLimit?: number, status?: string } = {}
  ): Promise<Song[]> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      const skip = (page - 1) * limit;
      
      const baseQuery: any = {};
      if (filters.genre) baseQuery.genre = { $in: [filters.genre] };
      if (filters.artist) baseQuery.artist = { $regex: filters.artist, $options: 'i' };
      if (filters.createdBy) baseQuery.createdBy = filters.createdBy;
      
      // If status filter is provided, apply it. For 'approved', also match missing status (legacy).
      if (filters.status === 'approved') {
        baseQuery.$or = [
          { status: 'approved' },
          { status: { $exists: false } }
        ];
      } else if (filters.status) {
        baseQuery.status = filters.status;
      }

      // If separate global/org limits are requested
      if (filters.globalLimit !== undefined || filters.orgLimit !== undefined) {
        const gLimit = filters.globalLimit ?? 0;
        const oLimit = filters.orgLimit ?? 1000;

        const orgOrCondition = [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: '' }];
        const globalQuery: any = { ...baseQuery };
        if (globalQuery.$or) {
          globalQuery.$and = [{ $or: globalQuery.$or }, { $or: orgOrCondition }];
          delete globalQuery.$or;
        } else {
          globalQuery.$or = orgOrCondition;
        }
        let gCursor = collection.find(globalQuery, { projection: { lyrics: 0 } }).sort({ createdAt: -1 });
        if (gLimit > 0) gCursor = gCursor.limit(gLimit);
        const globalDocs = await gCursor.toArray();

        let orgDocs: any[] = [];
        const orgQuery: any = { ...baseQuery, organizationId: { $nin: [null, ''] } };
        
        if (filters.userOrgIds) {
          if (filters.userOrgIds.length > 0) {
            orgQuery.organizationId = { $in: filters.userOrgIds };
            let oCursor = collection.find(orgQuery, { projection: { lyrics: 0 } }).sort({ createdAt: -1 });
            if (oLimit > 0) oCursor = oCursor.limit(oLimit);
            orgDocs = await oCursor.toArray();
          }
        } else {
          // Superadmin: fetch all org songs
          let oCursor = collection.find(orgQuery, { projection: { lyrics: 0 } }).sort({ createdAt: -1 });
          if (oLimit > 0) oCursor = oCursor.limit(oLimit);
          orgDocs = await oCursor.toArray();
        }

        const combined = [...globalDocs, ...orgDocs].sort((a: any, b: any) => b.createdAt - a.createdAt);
        return combined.map(doc => this.toSong(doc as unknown as MongoSong));
      }

      // Default pagination behavior
      const query: any = { ...baseQuery };
      if (filters.userOrgIds) {
        const orgOrCondition = [
          { organizationId: { $exists: false } },
          { organizationId: null },
          { organizationId: '' },
          { organizationId: { $in: filters.userOrgIds } }
        ];

        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: orgOrCondition }];
          delete query.$or;
        } else {
          query.$or = orgOrCondition;
        }
      }
      
      let cursor = collection
        .find(query, { projection: { lyrics: 0 } })
        .sort({ createdAt: -1 })
        .skip(skip);
        
      if (limit > 0) {
        cursor = cursor.limit(limit);
      }
      
      const results = await cursor.toArray();
      
      return results.map(doc => this.toSong(doc as unknown as MongoSong));
    } catch (error) {
      console.error("Error listing songs:", error);
      throw error;
    }
  }

  // Search approved global library songs by title, artist, or alias
  static async searchLibrary(query: string, limit = 25): Promise<{ id: string; title: string; artist?: string; aliases?: string[] }[]> {
    try {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const collection = await getCollection(COLLECTIONS.SONGS);
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const results = await collection
        .find(
          {
            $and: [
              {
                $or: [
                  { status: 'approved' },
                  { status: { $exists: false } },
                ],
              },
              {
                $or: [
                  { organizationId: { $exists: false } },
                  { organizationId: null },
                  { organizationId: '' },
                ],
              },
              {
                $or: [
                  { title: regex },
                  { artist: regex },
                  { aliases: regex },
                ],
              },
            ],
          },
          { projection: { title: 1, artist: 1, aliases: 1 } }
        )
        .sort({ title: 1 })
        .limit(limit)
        .toArray();

      return results.map((doc) => ({
        id: doc._id.toString(),
        title: doc.title,
        artist: doc.artist || undefined,
        aliases: doc.aliases || [],
      }));
    } catch (error) {
      console.error('Error searching song library:', error);
      throw error;
    }
  }

  /** Lightweight lookup by ids (preserves input order) */
  static async findByIdsLite(ids: string[]): Promise<{ id: string; title: string; artist?: string; aliases?: string[] }[]> {
    try {
      const unique = Array.from(new Set(ids.filter((id) => ObjectId.isValid(id))));
      if (!unique.length) return [];

      const collection = await getCollection(COLLECTIONS.SONGS);
      const results = await collection
        .find(
          { _id: { $in: unique.map((id) => new ObjectId(id)) } },
          { projection: { title: 1, artist: 1, aliases: 1 } }
        )
        .toArray();

      const byId = new Map(
        results.map((doc) => [
          doc._id.toString(),
          {
            id: doc._id.toString(),
            title: doc.title as string,
            artist: (doc.artist as string) || undefined,
            aliases: (doc.aliases as string[]) || [],
          },
        ])
      );

      return ids.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
    } catch (error) {
      console.error('Error finding songs by ids:', error);
      throw error;
    }
  }

  // Get lightweight catalog for AI Assistant
  static async getLightweightCatalog(userOrgIds?: string[]): Promise<any[]> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      
      const query: any = {};
      if (userOrgIds && userOrgIds.length > 0) {
        query.$or = [
          { organizationId: { $exists: false } },
          { organizationId: null },
          { organizationId: '' },
          { organizationId: { $in: userOrgIds } }
        ];
      } else {
        // Only global songs if no orgs provided
        query.$or = [
          { organizationId: { $exists: false } },
          { organizationId: null },
          { organizationId: '' }
        ];
      }
      
      const results = await collection
        .find(query, { projection: { title: 1, artist: 1, genre: 1, originalKey: 1, keywords: 1, language: 1, aliases: 1, status: 1 } })
        .toArray();
      
      return results.map(doc => ({
        id: doc._id.toString(),
        title: doc.title,
        artist: doc.artist,
        genre: doc.genre,
        originalKey: doc.originalKey,
        keywords: doc.keywords || [],
        language: doc.language || 'English',
        aliases: doc.aliases || [],
        status: doc.status || 'approved', // default to approved for legacy docs
      }));
    } catch (error) {
      console.error("Error getting song catalog:", error);
      throw error;
    }
  }

  // Get stats for songs (useful for admin dashboard)
  static async getStats(): Promise<{ totalSongs: number, songsPerGenre: Record<string, number> }> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      
      const totalSongs = await collection.countDocuments();
      
      const genreAggregation = await collection.aggregate([
        // Normalize: if genre is a string, convert to array; if array, use as-is
        { $addFields: { genreArr: { $cond: { if: { $isArray: '$genre' }, then: '$genre', else: ['$genre'] } } } },
        { $unwind: '$genreArr' },
        { $group: { _id: '$genreArr', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      const songsPerGenre: Record<string, number> = {};
      genreAggregation.forEach((item: any) => {
        songsPerGenre[item._id] = item.count;
      });
      
      return { totalSongs, songsPerGenre };
    } catch (error) {
      console.error("Error getting song stats:", error);
      throw error;
    }
  }
}
