
import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Favorite, MongoFavorite } from '@/lib/types';

export class FavoriteModel {
  static toFavorite(doc: MongoFavorite): Favorite {
    return {
      userId: doc.userId,
      songId: doc.songId,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  static async toggleLike(userId: string, songId: string): Promise<{ liked: boolean }> {
    try {
      const collection = await getCollection(COLLECTIONS.FAVORITES);
      const existing = await collection.findOne({ userId, songId });
      
      if (existing) {
        await collection.deleteOne({ _id: existing._id });
        return { liked: false };
      } else {
        await collection.insertOne({ 
          userId, 
          songId, 
          createdAt: new Date() 
        });
        return { liked: true };
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      throw error;
    }
  }

  static async isLikedByUser(userId: string, songId: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.FAVORITES);
      const existing = await collection.findOne({ userId, songId });
      return !!existing;
    } catch (error) {
      console.error("Error checking favorite status:", error);
      throw error;
    }
  }

  static async listFavoritesByUser(userId: string): Promise<string[]> {
    try {
      const collection = await getCollection(COLLECTIONS.FAVORITES);
      const results = await collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();
      return results.map(doc => doc.songId);
    } catch (error) {
      console.error("Error listing favorites by user:", error);
      throw error;
    }
  }

  static async getFavoritesCount(songId: string): Promise<number> {
    try {
      const collection = await getCollection(COLLECTIONS.FAVORITES);
      return await collection.countDocuments({ songId });
    } catch (error) {
      console.error("Error getting favorites count:", error);
      throw error;
    }
  }
}
