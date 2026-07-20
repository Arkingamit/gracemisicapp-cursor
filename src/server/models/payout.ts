import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

export interface Payout {
  id: string;
  userId: string;
  points: number;
  note?: string;
  paidBy: string;
  paidByName?: string;
  paidAt: string;
}

export interface MongoPayout {
  _id: ObjectId;
  userId: string;
  points: number;
  note?: string;
  paidBy: string;
  paidByName?: string;
  paidAt: Date;
}

export class PayoutModel {
  static toPayout(doc: MongoPayout): Payout {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      points: doc.points,
      note: doc.note,
      paidBy: doc.paidBy,
      paidByName: doc.paidByName,
      paidAt: doc.paidAt.toISOString(),
    };
  }

  static async create(data: {
    userId: string;
    points: number;
    note?: string;
    paidBy: string;
    paidByName?: string;
  }): Promise<Payout> {
    const collection = await getCollection(COLLECTIONS.PAYOUTS);
    const doc = {
      userId: data.userId,
      points: data.points,
      note: data.note?.trim() || undefined,
      paidBy: data.paidBy,
      paidByName: data.paidByName,
      paidAt: new Date(),
    } as unknown as MongoPayout;

    const result = await collection.insertOne(doc);
    return this.toPayout({ ...doc, _id: result.insertedId });
  }

  /** Sum of points already paid out per userId */
  static async getPaidPointsByUser(): Promise<Map<string, number>> {
    const collection = await getCollection(COLLECTIONS.PAYOUTS);
    const rows = await collection
      .aggregate<{ _id: string; total: number }>([
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
      ])
      .toArray();

    const map = new Map<string, number>();
    rows.forEach((row) => {
      if (row._id) map.set(row._id.toString(), row.total || 0);
    });
    return map;
  }

  static async listForUser(userId: string): Promise<Payout[]> {
    const collection = await getCollection(COLLECTIONS.PAYOUTS);
    const docs = await collection
      .find({ userId })
      .sort({ paidAt: -1 })
      .toArray();
    return docs.map((d) => this.toPayout(d as MongoPayout));
  }
}
