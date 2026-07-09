import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';

export interface AuditLog {
  id?: string;
  collectionName: string;
  documentId: string;
  action: 'create' | 'update' | 'delete';
  userId: string;
  timestamp: Date;
  itemName?: string;
  changes?: Record<string, any>;
  previousState?: Record<string, any>;
}

import { SettingsModel } from './settings';

export class AuditLogModel {
  static async log(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    try {
      const collection = await getCollection(COLLECTIONS.AUDIT_LOGS);
      await collection.insertOne({
        ...entry,
        timestamp: new Date()
      });

      // Implement log rotation / cleanup based on settings
      const settings = await SettingsModel.getSettings();
      if (settings.max_activity_logs && settings.max_activity_logs > 0) {
        // We delete logs that are older than the top N newest logs
        // Using an aggregation pipeline or skip logic is inefficient for large datasets, 
        // so we find the timestamp of the Nth log and delete anything older.
        const nthLog = await collection.find({})
          .sort({ timestamp: -1 })
          .skip(settings.max_activity_logs - 1)
          .limit(1)
          .toArray();

        if (nthLog.length > 0) {
          await collection.deleteMany({ timestamp: { $lt: nthLog[0].timestamp } });
        }
      }
    } catch (e) {
      console.error("Failed to write audit log:", e);
    }
  }

  static async getLogsForDocument(collectionName: string, documentId: string) {
    try {
      const collection = await getCollection(COLLECTIONS.AUDIT_LOGS);
      const results = await collection
        .find({ collectionName, documentId })
        .sort({ timestamp: -1 })
        .toArray();
      return results;
    } catch (e) {
      console.error("Failed to get audit logs:", e);
      return [];
    }
  }

  static async getRecentLogs(limit = 50) {
    try {
      const collection = await getCollection(COLLECTIONS.AUDIT_LOGS);
      const results = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      return results;
    } catch (e) {
      console.error("Failed to get recent audit logs:", e);
      return [];
    }
  }
}
