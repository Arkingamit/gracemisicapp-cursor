import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';

// GET /api/admin/chat-histories — Super admin: list all users' chat histories
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');
    if (auth.role !== 'super_admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);
    const usersCollection = await getCollection(COLLECTIONS.USERS);

    // Get all chat histories
    const histories = await collection.find({}).sort({ updatedAt: -1 }).toArray();

    // Enrich with user info
    const enriched = await Promise.all(
      histories.map(async (h: any) => {
        const { ObjectId } = await import('mongodb');
        const user = await usersCollection.findOne(
          { _id: h.userId.length === 24 ? new ObjectId(h.userId) : h.userId },
        );
        // If user not found by ObjectId, try by string
        const userByString = user || await usersCollection.findOne({ _id: h.userId as any });
        const resolvedUser = user || userByString;

        return {
          userId: h.userId,
          userName: resolvedUser?.name || resolvedUser?.username || 'Unknown',
          userEmail: resolvedUser?.email || 'Unknown',
          messageCount: h.messages?.length || 0,
          sizeBytes: new TextEncoder().encode(JSON.stringify(h.messages || [])).length,
          updatedAt: h.updatedAt?.toISOString() || null,
          createdAt: h.createdAt?.toISOString() || null,
          messages: h.messages || [],
        };
      })
    );

    return Response.json({ histories: enriched });
  } catch (error) {
    console.error('Admin chat histories error:', error);
    return Response.json({ error: 'Failed to fetch chat histories' }, { status: 500 });
  }
}

