import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

export interface AiUsageEntry {
  userId: string;
  type: 'chat' | 'search';
  query: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: Date;
}

export interface AiUsageSummary {
  userId: string;
  userName: string;
  userEmail: string;
  totalTokens: number;
  totalRequests: number;
  chatTokens: number;
  chatRequests: number;
  searchTokens: number;
  searchRequests: number;
  lastUsed: string;
}

export class AiUsageModel {
  // Log a single AI usage event
  static async log(entry: AiUsageEntry): Promise<void> {
    try {
      const collection = await getCollection(COLLECTIONS.AI_USAGE);
      await collection.insertOne({
        ...entry,
        createdAt: new Date(),
      });
    } catch (error) {
      // Don't throw - logging shouldn't break the main flow
      console.error('Error logging AI usage:', error);
    }
  }

  // Get per-user usage summary (for admin dashboard)
  static async getUserSummaries(): Promise<any[]> {
    try {
      const collection = await getCollection(COLLECTIONS.AI_USAGE);
      
      const results = await collection.aggregate([
        {
          $group: {
            _id: '$userId',
            totalTokens: { $sum: '$totalTokens' },
            totalRequests: { $sum: 1 },
            chatTokens: {
              $sum: { $cond: [{ $eq: ['$type', 'chat'] }, '$totalTokens', 0] }
            },
            chatRequests: {
              $sum: { $cond: [{ $eq: ['$type', 'chat'] }, 1, 0] }
            },
            searchTokens: {
              $sum: { $cond: [{ $eq: ['$type', 'search'] }, '$totalTokens', 0] }
            },
            searchRequests: {
              $sum: { $cond: [{ $eq: ['$type', 'search'] }, 1, 0] }
            },
            lastUsed: { $max: '$createdAt' },
          },
        },
        { $sort: { totalTokens: -1 } },
      ]).toArray();

      return results.map((r) => ({
        userId: r._id,
        totalTokens: r.totalTokens,
        totalRequests: r.totalRequests,
        chatTokens: r.chatTokens,
        chatRequests: r.chatRequests,
        searchTokens: r.searchTokens,
        searchRequests: r.searchRequests,
        lastUsed: r.lastUsed?.toISOString() || null,
      }));
    } catch (error) {
      console.error('Error getting AI usage summaries:', error);
      throw error;
    }
  }

  // Get global totals
  static async getGlobalTotals(): Promise<{ totalTokens: number; totalRequests: number }> {
    try {
      const collection = await getCollection(COLLECTIONS.AI_USAGE);
      const result = await collection.aggregate([
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$totalTokens' },
            totalRequests: { $sum: 1 },
          },
        },
      ]).toArray();

      return {
        totalTokens: result[0]?.totalTokens || 0,
        totalRequests: result[0]?.totalRequests || 0,
      };
    } catch (error) {
      console.error('Error getting global AI totals:', error);
      throw error;
    }
  }
}
