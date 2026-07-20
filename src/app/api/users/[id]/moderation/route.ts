import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, authError } from '@/lib/auth';
import { UserModel } from '@/server/models/user';
import { setUserModerationStatus } from '@/server/utils/spamDetection';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, moderationStatusEnum } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });

const moderationSchema = z
  .object({
    status: moderationStatusEnum,
    reason: z.string().max(500).optional(),
  })
  .strict();

// PATCH /api/users/[id]/moderation - Restrict or clear contributor moderation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const dbUser = await UserModel.findById(auth.userId);
    const role = dbUser?.role || auth.role;
    if (role !== 'super_admin') {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const parsed = await validateBody(request, moderationSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const status = body.status;

    if (status === 'ok') {
      await UserModel.update(id, {
        moderationStatus: 'ok',
        moderationReason: '',
        moderatedAt: new Date(),
      });
    } else {
      await setUserModerationStatus(
        id,
        status,
        body.reason || `Set to ${status} by admin`,
        'admin'
      );
    }

    const user = await UserModel.findById(id);
    return Response.json({ user, success: true });
  } catch (error) {
    console.error('Update moderation error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
