import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { SongReport, MongoSongReport, SongReportCategory, UserRole } from '@/lib/types';

export class SongReportModel {
  static toReport(doc: MongoSongReport): SongReport {
    return {
      id: doc._id.toString(),
      songId: doc.songId,
      songTitle: doc.songTitle,
      songArtist: doc.songArtist,
      songCreatedBy: doc.songCreatedBy,
      reporterId: doc.reporterId,
      reporterName: doc.reporterName,
      reporterRole: doc.reporterRole,
      category: doc.category,
      message: doc.message,
      reportUserAsSpammer: doc.reportUserAsSpammer,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  static async create(data: {
    songId: string;
    songTitle: string;
    songArtist?: string;
    songCreatedBy: string;
    reporterId: string;
    reporterName: string;
    reporterRole: UserRole;
    category: SongReportCategory;
    message?: string;
    reportUserAsSpammer?: boolean;
  }): Promise<SongReport> {
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);

    const doc = {
      songId: data.songId,
      songTitle: data.songTitle,
      songArtist: data.songArtist,
      songCreatedBy: data.songCreatedBy,
      reporterId: data.reporterId,
      reporterName: data.reporterName,
      reporterRole: data.reporterRole,
      category: data.category,
      message: data.message || '',
      reportUserAsSpammer: !!data.reportUserAsSpammer,
      status: 'new' as const,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(doc);
    return this.toReport({ _id: result.insertedId, ...doc } as unknown as MongoSongReport);
  }

  static async findExisting(songId: string, reporterId: string): Promise<SongReport | null> {
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);
    const doc = await collection.findOne({ songId, reporterId });
    return doc ? this.toReport(doc as unknown as MongoSongReport) : null;
  }

  static async list(status?: string): Promise<SongReport[]> {
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);
    const filter = status && status !== 'all' ? { status } : {};
    const results = await collection.find(filter).sort({ createdAt: -1 }).toArray();
    return results.map((doc) => this.toReport(doc as unknown as MongoSongReport));
  }

  static async updateStatus(id: string, status: 'new' | 'reviewed' | 'dismissed'): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);
    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
    return result.matchedCount === 1;
  }

  static async delete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  /** Count distinct reporters who reported songs by this contributor */
  static async countReportsAgainstUser(userId: string): Promise<number> {
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);
    const result = await collection
      .aggregate([{ $match: { songCreatedBy: userId } }, { $group: { _id: '$reporterId' } }, { $count: 'count' }])
      .toArray();
    return result[0]?.count || 0;
  }

  /** Count verifier spam-flags against a user */
  static async countSpammerReportsAgainstUser(userId: string): Promise<number> {
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);
    return collection.countDocuments({
      songCreatedBy: userId,
      reportUserAsSpammer: true,
    });
  }

  static async markAsSpammerReport(songId: string, reporterId: string): Promise<boolean> {
    const collection = await getCollection(COLLECTIONS.SONG_REPORTS);
    const result = await collection.updateOne(
      { songId, reporterId },
      { $set: { reportUserAsSpammer: true } }
    );
    return result.matchedCount === 1;
  }
}
