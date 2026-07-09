
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
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt?.toISOString() ?? doc.createdAt.toISOString(),
      organizationId: doc.organizationId || undefined,
      externalUrl: doc.externalUrl || undefined,
      originalKey: doc.originalKey,
      keywords: doc.keywords,
      format: doc.format || 'auto',
    };
  }

  // Find a song by ID
  static async findById(id: string): Promise<Song | null> {
    try {
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
    filters: { genre?: string, artist?: string, createdBy?: string, userOrgIds?: string[], globalLimit?: number, orgLimit?: number } = {}
  ): Promise<Song[]> {
    try {
      const collection = await getCollection(COLLECTIONS.SONGS);
      const skip = (page - 1) * limit;
      
      const baseQuery: any = {};
      if (filters.genre) baseQuery.genre = { $in: [filters.genre] };
      if (filters.artist) baseQuery.artist = { $regex: filters.artist, $options: 'i' };
      if (filters.createdBy) baseQuery.createdBy = filters.createdBy;

      // If separate global/org limits are requested
      if (filters.globalLimit !== undefined || filters.orgLimit !== undefined) {
        const gLimit = filters.globalLimit ?? 0;
        const oLimit = filters.orgLimit ?? 1000;

        const globalQuery = { ...baseQuery, $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: '' }] };
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
        query.$or = [
          { organizationId: { $exists: false } },
          { organizationId: null },
          { organizationId: '' },
          { organizationId: { $in: filters.userOrgIds } }
        ];
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
        .find(query, { projection: { title: 1, artist: 1, genre: 1, originalKey: 1, keywords: 1 } })
        .toArray();
      
      return results.map(doc => ({
        id: doc._id.toString(),
        title: doc.title,
        artist: doc.artist,
        genre: doc.genre,
        originalKey: doc.originalKey,
        keywords: doc.keywords || []
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
