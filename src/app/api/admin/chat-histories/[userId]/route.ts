import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const userIdParamsSchema = z.object({ userId: objectId });

// DELETE /api/admin/chat-histories/[userId] — Super admin: delete a user's chat history
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');
    if (auth.role !== 'super_admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const parsedParams = validateParams(await params, userIdParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { userId } = parsedParams.data;

    const collection = await getCollection(COLLECTIONS.CHAT_HISTORY);

    await collection.deleteOne({ userId });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Admin delete chat history error:', error);
    return Response.json({ error: 'Failed to delete chat history' }, { status: 500 });
  }
}
