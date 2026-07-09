import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { SettingsModel } from '@/server/models/settings';
import { UserModel } from '@/server/models/user';

// GET /api/ai/chat/history — Load chat history for the current user
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);
    const doc = await collection.findOne({ userId: auth.userId });

    return Response.json({ messages: doc?.messages || [] });
  } catch (error) {
    console.error('Load chat history error:', error);
    return Response.json({ error: 'Failed to load chat history' }, { status: 500 });
  }
}

// PUT /api/ai/chat/history — Save chat history for the current user (capped at 2 MB)
export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return Response.json({ error: 'messages must be an array' }, { status: 400 });
    }

    // Enforce MB limit: trim oldest messages until under the cap
    let trimmedMessages = messages;
    let serialized = JSON.stringify(trimmedMessages);

    const settings = await SettingsModel.getSettings();
    const user = await UserModel.findById(auth.userId);
    const limitMB = user?.aiChatLimitMB ?? settings.global_ai_chat_limit_mb ?? 2;
    const maxHistoryBytes = limitMB * 1024 * 1024;

    while (new TextEncoder().encode(serialized).length > maxHistoryBytes && trimmedMessages.length > 0) {
      // Remove the two oldest messages (user + assistant pair)
      trimmedMessages = trimmedMessages.slice(2);
      serialized = JSON.stringify(trimmedMessages);
    }

    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);
    await collection.updateOne(
      { userId: auth.userId },
      {
        $set: {
          messages: trimmedMessages,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          userId: auth.userId,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return Response.json({ success: true, messageCount: trimmedMessages.length });
  } catch (error) {
    console.error('Save chat history error:', error);
    return Response.json({ error: 'Failed to save chat history' }, { status: 500 });
  }
}

// DELETE /api/ai/chat/history — Clear chat history for the current user
export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);
    await collection.deleteOne({ userId: auth.userId });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Clear chat history error:', error);
    return Response.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
}

