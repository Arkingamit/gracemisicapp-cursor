
import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Playlist, PlaylistInput, MongoPlaylist } from '@/lib/types';

export class PlaylistModel {
  static toPlaylist(doc: MongoPlaylist): Playlist {
    return {
      id: doc._id.toString(),
      name: doc.name,
      userId: doc.userId,
      songs: doc.songs || [],
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  static async findById(id: string): Promise<Playlist | null> {
    try {
      const collection = await getCollection(COLLECTIONS.PLAYLISTS);
      const result = await collection.findOne({ _id: new ObjectId(id) });
      return result ? this.toPlaylist(result as unknown as MongoPlaylist) : null;
    } catch (error) {
      console.error("Error finding playlist by ID:", error);
      throw error;
    }
  }

  static async listByUser(userId: string): Promise<Playlist[]> {
    try {
      const collection = await getCollection(COLLECTIONS.PLAYLISTS);
      const results = await collection
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      return results.map(doc => this.toPlaylist(doc as unknown as MongoPlaylist));
    } catch (error) {
      console.error("Error listing playlists by user:", error);
      throw error;
    }
  }

  static async create(input: PlaylistInput): Promise<Playlist> {
    try {
      const collection = await getCollection(COLLECTIONS.PLAYLISTS);
      const now = new Date();
      
      const newPlaylist: any = {
        name: input.name,
        userId: input.userId,
        songs: input.songs || [],
        createdAt: now,
        updatedAt: now
      };
      
      const result = await collection.insertOne(newPlaylist);
      return {
        id: result.insertedId.toString(),
        name: input.name,
        userId: input.userId,
        songs: input.songs || [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
    } catch (error) {
      console.error("Error creating playlist:", error);
      throw error;
    }
  }

  static async update(id: string, name: string): Promise<Playlist | null> {
    try {
      const collection = await getCollection(COLLECTIONS.PLAYLISTS);
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            name, 
            updatedAt: new Date() 
          } 
        }
      );
      return await this.findById(id);
    } catch (error) {
      console.error("Error updating playlist:", error);
      throw error;
    }
  }

  static async addSong(id: string, songId: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.PLAYLISTS);
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $addToSet: { songs: songId },
          $set: { updatedAt: new Date() }
        }
      );
      return result.modifiedCount === 1;
    } catch (error) {
      console.error("Error adding song to playlist:", error);
      throw error;
    }
  }

  static async removeSong(id: string, songId: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.PLAYLISTS);
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $pull: { songs: songId },
          $set: { updatedAt: new Date() }
        }
      );
      return result.modifiedCount === 1;
    } catch (error) {
      console.error("Error removing song from playlist:", error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.PLAYLISTS);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting playlist:", error);
      throw error;
    }
  }
}
