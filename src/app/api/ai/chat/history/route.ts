import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { SettingsModel } from '@/server/models/settings';
import { UserModel } from '@/server/models/user';
import { validateBody, validateQuery } from '@/server/validation/http';

const historyGetQuerySchema = z
  .object({
    conversationId: z.string().max(100).optional(),
    channel: z.enum(['copilot', 'song-set', 'all']).optional(),
  })
  .strict();

const historyDeleteQuerySchema = z
  .object({
    conversationId: z.string().max(100).optional(),
    channel: z.enum(['copilot', 'song-set']).optional(),
  })
  .strict();

const historyPutSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            id: z.string().max(100).optional(),
            role: z.string().max(20),
            content: z.string().max(20000),
          })
          .passthrough()
      )
      .max(500),
    conversationId: z.string().max(100).optional(),
    channel: z.enum(['copilot', 'song-set']).optional(),
  })
  .strict();

type ChatMessage = {
  id: string;
  role: string;
  content: string;
};

export type ChatChannel = 'copilot' | 'song-set';

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** 'copilot' = Grace Copilot FAB; 'song-set' = Song Set Builder */
  channel: ChatChannel;
  createdAt: Date;
  updatedAt: Date;
};

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.content?.trim());
  if (!firstUser) return 'New conversation';
  const text = firstUser.content.trim().replace(/\s+/g, ' ');
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function inferChannel(id: string, explicit?: string): ChatChannel {
  if (explicit === 'song-set' || explicit === 'copilot') return explicit;
  if (typeof id === 'string' && id.startsWith('songset_')) return 'song-set';
  return 'copilot';
}

/** Normalize legacy single-thread docs into a conversations array. */
function getConversations(doc: any): Conversation[] {
  if (Array.isArray(doc?.conversations) && doc.conversations.length > 0) {
    return doc.conversations.map((c: any) => ({
      id: c.id,
      title: c.title || 'Conversation',
      messages: Array.isArray(c.messages) ? c.messages : [],
      channel: inferChannel(c.id, c.channel),
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
    }));
  }

  // Legacy: one messages array on the user doc
  if (Array.isArray(doc?.messages) && doc.messages.length > 0) {
    return [
      {
        id: `legacy-${doc.userId}`,
        title: deriveTitle(doc.messages),
        messages: doc.messages,
        channel: 'copilot' as ChatChannel,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      },
    ];
  }

  return [];
}

function trimToLimit(messages: ChatMessage[], maxBytes: number): ChatMessage[] {
  let trimmed = messages;
  let serialized = JSON.stringify(trimmed);
  while (new TextEncoder().encode(serialized).length > maxBytes && trimmed.length > 0) {
    trimmed = trimmed.slice(2);
    serialized = JSON.stringify(trimmed);
  }
  return trimmed;
}

function parseChannelParam(raw: string | null): ChatChannel | 'all' {
  if (raw === 'song-set' || raw === 'copilot' || raw === 'all') return raw;
  return 'copilot';
}

// GET /api/ai/chat/history?conversationId=...&channel=copilot|song-set|all
// - With conversationId: return that conversation's messages
// - Without: return conversation list filtered by channel (default: copilot)
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const queryCheck = validateQuery(req, historyGetQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');
    const channelFilter = parseChannelParam(url.searchParams.get('channel'));

    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);
    const doc = await collection.findOne({ userId: auth.userId });
    const conversations = getConversations(doc);

    if (conversationId) {
      const conversation = conversations.find((c) => c.id === conversationId);
      return Response.json({
        conversationId,
        messages: conversation?.messages || [],
        title: conversation?.title || null,
        channel: conversation?.channel || inferChannel(conversationId),
      });
    }

    const filtered =
      channelFilter === 'all'
        ? conversations
        : conversations.filter((c) => c.channel === channelFilter);

    return Response.json({
      conversations: filtered.map((c) => ({
        id: c.id,
        title: c.title,
        channel: c.channel,
        messageCount: c.messages.length,
        updatedAt: c.updatedAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Load chat history error:', error);
    return Response.json({ error: 'Failed to load chat history' }, { status: 500 });
  }
}

// PUT /api/ai/chat/history — Save messages into a specific conversation
export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const parsed = await validateBody(req, historyPutSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const messages = body.messages;
    const conversationId =
      typeof body.conversationId === 'string' && body.conversationId.trim()
        ? body.conversationId.trim()
        : new ObjectId().toString();
    const channel = inferChannel(conversationId, body.channel);

    const settings = await SettingsModel.getSettings();
    const user = await UserModel.findById(auth.userId);
    const limitMB = user?.aiChatLimitMB ?? settings.global_ai_chat_limit_mb ?? 2;
    const maxHistoryBytes = limitMB * 1024 * 1024;

    const trimmedMessages = trimToLimit(messages as ChatMessage[], maxHistoryBytes);
    const now = new Date();

    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);
    const doc = await collection.findOne({ userId: auth.userId });
    let conversations = getConversations(doc);

    const existingIdx = conversations.findIndex((c) => c.id === conversationId);
    const nextConversation: Conversation = {
      id: conversationId,
      title: deriveTitle(trimmedMessages),
      messages: trimmedMessages,
      channel:
        existingIdx >= 0
          ? // Keep channel stable once set; allow upgrade from inferred → explicit
            body.channel
              ? channel
              : conversations[existingIdx].channel
          : channel,
      createdAt: existingIdx >= 0 ? conversations[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      conversations[existingIdx] = nextConversation;
    } else {
      conversations = [nextConversation, ...conversations];
    }

    // Cap per channel so song-set history doesn't push out Copilot chats
    const byChannel = (ch: ChatChannel) =>
      conversations
        .filter((c) => c.channel === ch)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 40);
    conversations = [...byChannel('copilot'), ...byChannel('song-set')].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    await collection.updateOne(
      { userId: auth.userId },
      {
        $set: {
          conversations,
          updatedAt: now,
          messages: [],
        },
        $setOnInsert: {
          userId: auth.userId,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return Response.json({
      success: true,
      conversationId,
      channel: nextConversation.channel,
      messageCount: trimmedMessages.length,
    });
  } catch (error) {
    console.error('Save chat history error:', error);
    return Response.json({ error: 'Failed to save chat history' }, { status: 500 });
  }
}

// DELETE /api/ai/chat/history?conversationId=...&channel=copilot|song-set
// - With conversationId: delete that conversation
// - Without conversationId + channel: clear only that channel
// - Without both: clear all (legacy)
export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const queryCheck = validateQuery(req, historyDeleteQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');
    const channelParam = url.searchParams.get('channel');
    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);

    if (!conversationId && !channelParam) {
      await collection.deleteOne({ userId: auth.userId });
      return Response.json({ success: true });
    }

    const doc = await collection.findOne({ userId: auth.userId });
    let conversations = getConversations(doc);

    if (conversationId) {
      conversations = conversations.filter((c) => c.id !== conversationId);
    } else if (channelParam === 'copilot' || channelParam === 'song-set') {
      conversations = conversations.filter((c) => c.channel !== channelParam);
    }

    await collection.updateOne(
      { userId: auth.userId },
      {
        $set: {
          conversations,
          messages: [],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error('Clear chat history error:', error);
    return Response.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
}
