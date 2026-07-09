
import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Message, MessageInput, MongoMessage } from '@/lib/types';

export class MessageModel {
  // Convert MongoDB document to application Message type
  static toMessage(doc: MongoMessage): Message {
    return {
      id: doc._id.toString(),
      content: doc.content,
      groupId: doc.groupId,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt.toISOString()
    };
  }

  // Create a new message
  static async create(messageInput: MessageInput, createdBy: string): Promise<Message> {
    try {
      const collection = await getCollection(COLLECTIONS.MESSAGES);
      const now = new Date();
      
      const newMessage = {
        content: messageInput.content,
        groupId: messageInput.groupId,
        createdBy,
        createdAt: now
      };
      
      const result = await collection.insertOne(newMessage);
      return {
        id: result.insertedId.toString(),
        content: messageInput.content,
        groupId: messageInput.groupId,
        createdBy,
        createdAt: now.toISOString()
      };
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }

  // Get messages for a group
  static async getGroupMessages(groupId: string, limit = 50): Promise<Message[]> {
    try {
      const collection = await getCollection(COLLECTIONS.MESSAGES);
      
      const results = await collection
        .find({ groupId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      
      // Return in chronological order
      return results.map(doc => this.toMessage(doc as MongoMessage)).reverse();
    } catch (error) {
      console.error("Error getting group messages:", error);
      throw error;
    }
  }

  // Delete message
  static async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.MESSAGES);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }
}
