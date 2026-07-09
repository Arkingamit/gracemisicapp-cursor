import { NextRequest } from 'next/server';
import { MessageModel } from '@/server/models/message';
import { getAuthUser, authError } from '@/lib/auth';

// GET /api/groups/[id]/messages - Get messages for a group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { id } = await params;
    const { content } = await request.json();
    const message = await MessageModel.create({ content, groupId: id }, auth.userId);
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Create group message error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
