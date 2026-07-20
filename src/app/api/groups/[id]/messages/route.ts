import { NextRequest } from 'next/server';
import { z } from 'zod';
import { MessageModel } from '@/server/models/message';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody, validateParams, validateQuery } from '@/server/validation/http';
import { objectId, boundedString, MESSAGE_MAX } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const messagesQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(500).optional() })
  .strict();
const messageBodySchema = z.object({ content: boundedString(MESSAGE_MAX) }).strict();

// GET /api/groups/[id]/messages - Get messages for a group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const queryCheck = validateQuery(request, messagesQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const messages = await MessageModel.getGroupMessages(id, limit);
    return Response.json({ messages });
  } catch (error) {
    console.error('Get group messages error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/groups/[id]/messages - Create a message in the group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const parsed = await validateBody(request, messageBodySchema);
    if (!parsed.ok) return parsed.response;
    const { content } = parsed.data;
    const message = await MessageModel.create({ content, groupId: id }, auth.userId);
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Create group message error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
