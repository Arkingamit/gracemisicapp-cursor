import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, authError } from '@/lib/auth';
import { SongReportModel } from '@/server/models/songReport';
import { UserModel } from '@/server/models/user';
import { setUserModerationStatus } from '@/server/utils/spamDetection';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, songReportStatusEnum } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const songReportPatchSchema = z
  .object({
    status: songReportStatusEnum.optional(),
    restrictUserId: objectId.optional(),
    clearModerationUserId: objectId.optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

// PATCH /api/admin/song-reports/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const dbUser = await UserModel.findById(auth.userId);
    const role = dbUser?.role || auth.role;
    if (role !== 'super_admin' && role !== 'editor') {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;

    const parsed = await validateBody(request, songReportPatchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { status, restrictUserId, clearModerationUserId } = body;

    if (status) {
      const ok = await SongReportModel.updateStatus(id, status);
      if (!ok) {
        return Response.json({ error: 'Report not found' }, { status: 404 });
      }
    }

    if (restrictUserId) {
      await setUserModerationStatus(
        restrictUserId,
        'restricted',
        body.reason || 'Restricted by admin after reviewing song reports',
        'admin'
      );
    }

    if (clearModerationUserId) {
      await UserModel.update(clearModerationUserId, {
        moderationStatus: 'ok',
        moderationReason: '',
        moderatedAt: new Date(),
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update song report error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/song-reports/[id]
export async function DELETE(
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
    const ok = await SongReportModel.delete(id);
    if (!ok) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete song report error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
