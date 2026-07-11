import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscription {
  id: string;
  userId: string;
  subscription: PushSubscriptionData;
  createdAt: string;
}

export interface MongoPushSubscription {
  _id: ObjectId;
  userId: string;
  subscription: PushSubscriptionData;
  createdAt: Date;
}

export class PushSubscriptionModel {
  static async upsert(userId: string, subscription: PushSubscriptionData): Promise<void> {
    const collection = await getCollection(COLLECTIONS.PUSH_SUBSCRIPTIONS);
    
    // Check if this endpoint already exists for any user to avoid duplicates
    // If it exists for the same user, we just update it.
    await collection.updateOne(
      { 'subscription.endpoint': subscription.endpoint },
      { 
        $set: { 
          userId,
          subscription,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  static async findByUserId(userId: string): Promise<PushSubscriptionData[]> {
    const collection = await getCollection(COLLECTIONS.PUSH_SUBSCRIPTIONS);
    const results = await collection
      .find({ userId })
      .toArray();
      
    return results.map(doc => (doc as MongoPushSubscription).subscription);
  }

  static async removeByEndpoint(endpoint: string): Promise<void> {
    const collection = await getCollection(COLLECTIONS.PUSH_SUBSCRIPTIONS);
    await collection.deleteOne({ 'subscription.endpoint': endpoint });
  }
}
