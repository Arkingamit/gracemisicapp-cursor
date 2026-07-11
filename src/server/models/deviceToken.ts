import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: 'android' | 'ios';
  createdAt: string;
  updatedAt: string;
}

export interface MongoDeviceToken {
  _id: ObjectId;
  userId: string;
  token: string;
  platform: 'android' | 'ios';
  createdAt: Date;
  updatedAt: Date;
}

export class DeviceTokenModel {
  static toDeviceToken(doc: MongoDeviceToken): DeviceToken {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      token: doc.token,
      platform: doc.platform,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * Upsert a device token. If the token already exists (for any user),
   * update it to the current user to avoid duplicates.
   */
  static async upsert(userId: string, token: string, platform: 'android' | 'ios'): Promise<void> {
    const collection = await getCollection(COLLECTIONS.DEVICE_TOKENS);

    await collection.updateOne(
      { token },
      {
        $set: {
          userId,
          token,
          platform,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }

  /**
   * Find all device tokens for a given user.
   */
  static async findByUserId(userId: string): Promise<DeviceToken[]> {
    const collection = await getCollection(COLLECTIONS.DEVICE_TOKENS);
    const results = await collection.find({ userId }).toArray();
    return results.map((doc) => this.toDeviceToken(doc as MongoDeviceToken));
  }

  /**
   * Remove a specific device token (e.g. when FCM reports it as invalid).
   */
  static async removeByToken(token: string): Promise<void> {
    const collection = await getCollection(COLLECTIONS.DEVICE_TOKENS);
    await collection.deleteOne({ token });
  }

  /**
   * Remove all device tokens for a user (e.g. on logout).
   */
  static async removeByUserId(userId: string): Promise<void> {
    const collection = await getCollection(COLLECTIONS.DEVICE_TOKENS);
    await collection.deleteMany({ userId });
  }
}
