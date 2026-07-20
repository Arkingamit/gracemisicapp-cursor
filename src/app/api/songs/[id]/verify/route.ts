import { NextRequest } from 'next/server';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';
import { UserModel } from '@/server/models/user';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';
import { appCache } from '@/server/cache';
import {
  SONG_REPORT_CATEGORIES,
  SongReportCategory,
  getReportCategoryLabel,
} from '@/lib/spamReportCategories';
import { checkRejectionThreshold, checkSpammerReportThreshold, checkSongReportThreshold } from '@/server/utils/spamDetection';
import { SongReportModel } from '@/server/models/songReport';
import { hasAnyRole } from '@/lib/roles';
import { z } from 'zod';
import { validateBody, validateParams } from '@/server/validation/http';
import {
  objectId,
  verifyDecisionEnum,
  songReportCategoryEnum,
} from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const verifySchema = z
  .object({
    status: verifyDecisionEnum,
    rejectionCategory: songReportCategoryEnum.optional(),
    rejectionMessage: z.string().max(1000).optional(),
    reportUserAsSpammer: z.boolean().optional(),
  })
  .strict();

const VALID_CATEGORIES = new Set(SONG_REPORT_CATEGORIES.map((c) => c.key));

// PATCH /api/songs/[id]/verify - Verify a song (Approve/Reject)
export async function PATCH(
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

    const dbUser = await UserModel.findById(auth.userId);
    if (!hasAnyRole(dbUser || auth, 'editor', 'verifier')) {
      return Response.json(
        { error: 'You do not have permission to verify songs' },
        { status: 403 }
      );
    }

    const actualRole = dbUser?.role || auth.role;

    const parsed = await validateBody(request, verifySchema);
    if (!parsed.ok) return parsed.response;
    const { status, rejectionCategory, rejectionMessage, reportUserAsSpammer } = parsed.data;

    if (status === 'rejected') {
      if (!rejectionCategory || !VALID_CATEGORIES.has(rejectionCategory as SongReportCategory)) {
        return Response.json(
          { error: 'Please select a rejection reason' },
          { status: 400 }
        );
      }
      if (rejectionCategory === 'other' && !String(rejectionMessage || '').trim()) {
        return Response.json(
          { error: 'Please describe the issue when selecting Other' },
          { status: 400 }
        );
      }
    }

    const existingSong = await SongModel.findById(id);
    if (!existingSong) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }

    const category = rejectionCategory as SongReportCategory | undefined;
    const reasonLabel = category ? getReportCategoryLabel(category) : undefined;
    const fullReason = category
      ? [reasonLabel, rejectionMessage?.trim()].filter(Boolean).join(' — ')
      : undefined;

    const updates: Record<string, unknown> = {
      status,
      verifiedBy: auth.userId,
      verifiedAt: new Date().toISOString(),
    };

    if (status === 'rejected' && fullReason) {
      updates.rejectionReason = fullReason;
      updates.rejectionCategory = category;
    }

    const song = await SongModel.update(id, updates as any);
    if (!song) {
      return Response.json({ error: 'Failed to update song' }, { status: 500 });
    }

    await AuditLogModel.log({
      collectionName: COLLECTIONS.SONGS,
      documentId: id,
      action: (status === 'approved' ? 'verify_approve' : 'verify_reject') as any,
      userId: auth.userId,
      itemName: fullReason
        ? `${existingSong.title} — ${existingSong.artist} (${fullReason})`
        : `${existingSong.title} — ${existingSong.artist}`,
    });

    if (status === 'rejected' && existingSong.createdBy) {
      // Create a song report from the verifier for tracking
      if (category) {
        const existingReport = await SongReportModel.findExisting(id, auth.userId);
        if (!existingReport) {
          await SongReportModel.create({
            songId: existingSong.id,
            songTitle: existingSong.title,
            songArtist: existingSong.artist,
            songCreatedBy: existingSong.createdBy,
            reporterId: auth.userId,
            reporterName: dbUser?.name || dbUser?.displayName || auth.email,
            reporterRole: actualRole,
            category,
            message: rejectionMessage?.trim() || '',
            reportUserAsSpammer: !!reportUserAsSpammer,
          });
        } else if (reportUserAsSpammer && !existingReport.reportUserAsSpammer) {
          await SongReportModel.markAsSpammerReport(id, auth.userId);
        }

        if (reportUserAsSpammer) {
          await checkSpammerReportThreshold(existingSong.createdBy);
        }
        await checkSongReportThreshold(existingSong.createdBy);
      }

      await checkRejectionThreshold(existingSong.createdBy);
    }

    appCache.invalidate('songs:');

    return Response.json({ song, message: `Song ${status} successfully` });
  } catch (error) {
    console.error('Verify song error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
