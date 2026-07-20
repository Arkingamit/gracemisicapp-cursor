import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';

function getConversations(doc: any) {
  if (Array.isArray(doc?.conversations) && doc.conversations.length > 0) {
    return doc.conversations;
  }
  if (Array.isArray(doc?.messages) && doc.messages.length > 0) {
    return [
      {
        id: `legacy-${doc.userId}`,
        title: 'Conversation',
        messages: doc.messages,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    ];
  }
  return [];
}

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

    const histories = await collection.find({}).sort({ updatedAt: -1 }).toArray();

    const enriched = await Promise.all(
      histories.map(async (h: any) => {
        const { ObjectId } = await import('mongodb');
        const user = await usersCollection.findOne(
          { _id: h.userId.length === 24 ? new ObjectId(h.userId) : h.userId },
        );
        const userByString = user || (await usersCollection.findOne({ _id: h.userId as any }));
        const resolvedUser = user || userByString;

        const conversations = getConversations(h);
        const allMessages = conversations.flatMap((c: any) =>
          (c.messages || []).map((m: any) => ({
            ...m,
            conversationId: c.id,
            conversationTitle: c.title,
          }))
        );

        return {
          userId: h.userId,
          userName: resolvedUser?.name || resolvedUser?.username || 'Unknown',
          userEmail: resolvedUser?.email || 'Unknown',
          conversationCount: conversations.length,
          messageCount: allMessages.length,
          sizeBytes: new TextEncoder().encode(JSON.stringify(conversations)).length,
          updatedAt: h.updatedAt?.toISOString() || null,
          createdAt: h.createdAt?.toISOString() || null,
          conversations: conversations.map((c: any) => ({
            id: c.id,
            title: c.title || 'Conversation',
            messageCount: (c.messages || []).length,
            updatedAt: c.updatedAt
              ? new Date(c.updatedAt).toISOString()
              : null,
            messages: c.messages || [],
          })),
          // Keep flat messages for search compatibility
          messages: allMessages,
        };
      })
    );

    return Response.json({ histories: enriched });
  } catch (error) {
    console.error('Admin chat histories error:', error);
    return Response.json({ error: 'Failed to fetch chat histories' }, { status: 500 });
  }
}
