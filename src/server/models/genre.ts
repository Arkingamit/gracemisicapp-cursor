
import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Genre, MongoGenre } from '@/lib/types';

export class GenreModel {
  // Convert MongoDB document to application Genre type
  static toGenre(doc: MongoGenre): Genre {
    return {
      id: doc._id.toString(),
      name: doc.name,
      createdAt: doc.createdAt.toISOString()
    };
  }

  // Find a genre by ID
  static async findById(id: string): Promise<Genre | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GENRES);
      const result = await collection.findOne({ _id: new ObjectId(id) });
      return result ? this.toGenre(result as unknown as MongoGenre) : null;
    } catch (error) {
      console.error("Error finding genre by ID:", error);
      throw error;
    }
  }

  // Create a new genre
  static async create(name: string): Promise<Genre> {
    try {
      const collection = await getCollection(COLLECTIONS.GENRES);
      const now = new Date();
      
      // Check if genre already exists
      const existing = await collection.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (existing) {
        throw new Error('Genre already exists');
      }
      
      const newGenre = {
        name,
        createdAt: now
      };
      
      const result = await collection.insertOne(newGenre);
      return {
        id: result.insertedId.toString(),
        name,
        createdAt: now.toISOString()
      };
    } catch (error) {
      console.error("Error creating genre:", error);
      throw error;
    }
  }

  // Update a genre
  static async update(id: string, name: string): Promise<Genre | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GENRES);
      
      // Check if new name already exists (excluding current genre)
      const existing = await collection.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: new ObjectId(id) }
      });
      if (existing) {
        throw new Error('Genre name already exists');
      }
      
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { name } }
      );
      
      return await this.findById(id);
    } catch (error) {
      console.error("Error updating genre:", error);
      throw error;
    }
  }

  // Delete a genre
  static async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.GENRES);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting genre:", error);
      throw error;
    }
  }

  // List all genres
  static async list(): Promise<Genre[]> {
    try {
      const collection = await getCollection(COLLECTIONS.GENRES);
      const results = await collection
        .find({})
        .sort({ name: 1 })
        .toArray();
      
      return results.map(doc => this.toGenre(doc as unknown as MongoGenre));
    } catch (error) {
      console.error("Error listing genres:", error);
      throw error;
    }
  }

  // Seed default genres
  static async seedDefaults(): Promise<void> {
    try {
      const collection = await getCollection(COLLECTIONS.GENRES);
      const count = await collection.countDocuments();
      
      if (count === 0) {
        const defaultGenres = [
          'Worship', 'Praise', 'Hymn', 'Christian Rock', 
          'Hindi Gospel', 'English Gospel', 'Modern Genres',
          'Rock', 'Pop', 'Country', 'Blues', 'Jazz', 
          'Classical', 'Folk', 'Gospel', 'R&B', 'Electronic', 
          'Alternative', 'Indie'
        ];
        
        const genreDocuments = defaultGenres.map(name => ({
          name,
          createdAt: new Date()
        }));
        
        await collection.insertMany(genreDocuments);
      }
    } catch (error) {
      console.error("Error seeding default genres:", error);
      throw error;
    }
  }
}
