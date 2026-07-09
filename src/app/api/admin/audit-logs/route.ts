import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { UserModel } from '@/server/models/user';
import { SongModel } from '@/server/models/song';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { ObjectId } from 'mongodb';

// Resolve a document ID to a human-readable name based on the collection
async function resolveItemName(collectionName: string, documentId: string): Promise<string | null> {
  try {
    switch (collectionName) {
      case COLLECTIONS.SONGS: {
        const song = await SongModel.findById(documentId);
        return song ? `${song.title} — ${song.artist}` : null;
      }
      case COLLECTIONS.GROUPS: {
        const col = await getCollection(COLLECTIONS.GROUPS);
        const doc = await col.findOne({ _id: new ObjectId(documentId) });
        return doc ? (doc.name as string) : null;
      }
      case COLLECTIONS.ORGANIZATIONS: {
        const col = await getCollection(COLLECTIONS.ORGANIZATIONS);
        const doc = await col.findOne({ _id: new ObjectId(documentId) });
        return doc ? (doc.name as string) : null;
      }
      case COLLECTIONS.PLAYLISTS: {
        const col = await getCollection(COLLECTIONS.PLAYLISTS);
        const doc = await col.findOne({ _id: new ObjectId(documentId) });
        return doc ? (doc.name as string) : null;
      }
      case COLLECTIONS.USERS: {
        const user = await UserModel.findById(documentId);
        return user ? `${user.name} (${user.email})` : null;
      }
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth || auth.role !== 'super_admin') {
      return authError('Not authorized');
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const logs = await AuditLogModel.getRecentLogs(limit);

    // Populate user details and resolve item names for each log
    const populatedLogs = await Promise.all(
      logs.map(async (log) => {
        let user = null;
        try {
          user = await UserModel.findById(log.userId);
        } catch (e) {
          // Ignore if user not found
        }

        // Use stored itemName first (always available even for deleted items),
        // fall back to live lookup for older logs that don't have it
        const itemName = log.itemName || await resolveItemName(log.collectionName, log.documentId);

        return {
          ...log,
          _id: log._id?.toString(),
          user: user ? { id: user.id, name: user.name, email: user.email } : null,
          itemName: itemName || null,
        };
      })
    );

    return Response.json({ logs: populatedLogs });
  } catch (error) {
    console.error('Admin audit logs error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

