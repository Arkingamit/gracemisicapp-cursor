import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Feedback, MongoFeedback } from '@/lib/types';

export class FeedbackModel {
  static toFeedback(doc: MongoFeedback): Feedback {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      userName: doc.userName,
      type: doc.type,
      message: doc.message,
      status: doc.status,
      createdAt: doc.createdAt.toISOString()
    };
  }

  static async create(data: { userId: string, userName: string, type: 'question' | 'bug' | 'general' | 'idea', message: string }): Promise<Feedback> {
    try {
      const collection = await getCollection(COLLECTIONS.FEEDBACK);
      
      const newFeedback = {
        userId: data.userId,
        userName: data.userName,
        type: data.type,
        message: data.message,
        status: 'new' as const,
        createdAt: new Date()
      };
      
      const result = await collection.insertOne(newFeedback);
      
      return {
        id: result.insertedId.toString(),
        userId: newFeedback.userId,
        userName: newFeedback.userName,
        type: newFeedback.type,
        message: newFeedback.message,
        status: newFeedback.status,
        createdAt: newFeedback.createdAt.toISOString()
      };
    } catch (error) {
      console.error("Error creating feedback:", error);
      throw error;
    }
  }

  static async list(): Promise<Feedback[]> {
    try {
      const collection = await getCollection(COLLECTIONS.FEEDBACK);
      
      const results = await collection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      
      return results.map(doc => this.toFeedback(doc as unknown as MongoFeedback));
    } catch (error) {
      console.error("Error listing feedback:", error);
      throw error;
    }
  }

  static async updateStatus(id: string, status: 'new' | 'in-progress' | 'resolved'): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.FEEDBACK);
      
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      
      return result.modifiedCount === 1 || result.matchedCount === 1;
    } catch (error) {
      console.error("Error updating feedback status:", error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.FEEDBACK);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting feedback:", error);
      throw error;
    }
  }
}
