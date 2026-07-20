import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { SongModel } from '@/server/models/song';
import { UserModel } from '@/server/models/user';
import { SongReportModel } from '@/server/models/songReport';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';
import { SONG_REPORT_CATEGORIES, SongReportCategory } from '@/lib/spamReportCategories';
import {
  checkSongReportThreshold,
  checkSpammerReportThreshold,
} from '@/server/utils/spamDetection';
import { hasAnyRole } from '@/lib/roles';
import { z } from 'zod';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, songReportCategoryEnum } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const reportSchema = z
  .object({
    category: songReportCategoryEnum,
    message: z.string().max(1000).optional(),
    reportUserAsSpammer: z.boolean().optional(),
  })
  .strict();

const VALID_CATEGORIES = new Set(SONG_REPORT_CATEGORIES.map((c) => c.key));

// POST /api/songs/[id]/report - Report a song (any authenticated user)
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

    const parsed = await validateBody(request, reportSchema);
    if (!parsed.ok) return parsed.response;
    const category = parsed.data.category as SongReportCategory;
    const message = (parsed.data.message || '').trim();
    const reportUserAsSpammer = !!parsed.data.reportUserAsSpammer;

    if (category === 'other' && !message) {
      return Response.json(
        { error: 'Please describe the issue when selecting Other' },
        { status: 400 }
      );
    }

    const song = await SongModel.findById(id);
    if (!song) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }

    if (song.createdBy === auth.userId) {
      return Response.json({ error: 'You cannot report your own song' }, { status: 400 });
    }

    const dbUser = await UserModel.findById(auth.userId);
    const actualRole = dbUser?.role || auth.role;

    const canReportSpammer = hasAnyRole({ role: actualRole, roles: dbUser?.roles }, 'editor', 'verifier');
    if (reportUserAsSpammer && !canReportSpammer) {
      return Response.json(
        { error: 'Only verifiers can report a user as a spammer' },
        { status: 403 }
      );
    }

    const existing = await SongReportModel.findExisting(id, auth.userId);
    if (existing) {
      return Response.json(
        { error: 'You have already reported this song', report: existing },
        { status: 409 }
      );
    }

    const report = await SongReportModel.create({
      songId: song.id,
      songTitle: song.title,
      songArtist: song.artist,
      songCreatedBy: song.createdBy,
      reporterId: auth.userId,
      reporterName: dbUser?.name || dbUser?.displayName || auth.email,
      reporterRole: actualRole,
      category,
      message,
      reportUserAsSpammer: reportUserAsSpammer && canReportSpammer,
    });

    await AuditLogModel.log({
      collectionName: COLLECTIONS.SONG_REPORTS,
      documentId: report.id,
      action: 'create',
      userId: auth.userId,
      itemName: `Report: ${song.title} (${category})`,
    });

    // Auto-detection hooks
    await checkSongReportThreshold(song.createdBy);
    if (report.reportUserAsSpammer) {
      await checkSpammerReportThreshold(song.createdBy);
    }

    return Response.json({ report, message: 'Report submitted. Thank you.' }, { status: 201 });
  } catch (error) {
    console.error('Report song error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
