import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface MongoNotification {
  _id: ObjectId;
  userId: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

export class NotificationModel {
  static toNotification(doc: MongoNotification): Notification {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      message: doc.message,
      link: doc.link,
      isRead: doc.isRead,
      createdAt: doc.createdAt.toISOString()
    };
  }

  static async create(userId: string, title: string, message: string, link?: string): Promise<Notification> {
    const collection = await getCollection(COLLECTIONS.NOTIFICATIONS);
    const now = new Date();
    
    const newDoc = {
      userId,
      title,
      message,
      link,
      isRead: false,
      createdAt: now
    };
    
    const result = await collection.insertOne(newDoc);
    
    return {
      id: result.insertedId.toString(),
      userId,
      title,
      message,
      link,
      isRead: false,
      createdAt: now.toISOString()
    };
  }

  static async findByUserId(userId: string, limit = 50): Promise<Notification[]> {
    const collection = await getCollection(COLLECTIONS.NOTIFICATIONS);
    const results = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
      
    return results.map(doc => this.toNotification(doc as MongoNotification));
  }

  static async markAsRead(notificationIds: string[], userId: string): Promise<boolean> {
    const collection = await getCollection(COLLECTIONS.NOTIFICATIONS);
    const objectIds = notificationIds.map(id => new ObjectId(id));
    
    const result = await collection.updateMany(
      { _id: { $in: objectIds }, userId },
      { $set: { isRead: true } }
    );
    
    return result.modifiedCount > 0;
  }
}
