import { NextRequest } from 'next/server';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';
import { UserModel } from '@/server/models/user';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';
import { getCollection } from '@/server/db/connection';
import { ObjectId } from 'mongodb';
import { appCache } from '@/server/cache';
import { z } from 'zod';
import { validateBody, validateParams } from '@/server/validation/http';
import { objectId, boundedString } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const addAliasSchema = z
  .object({
    canonicalSongId: objectId,
    aliasTitle: boundedString(120),
  })
  .strict();

// PATCH /api/songs/[id]/add-alias
// Adds the pending song's title as an alias to an existing song, then rejects the pending duplicate.
// Body: { canonicalSongId: string, aliasTitle: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const dbUser = await UserModel.findById(auth.userId);
    const actualRole = dbUser?.role || auth.role;

    if (actualRole !== 'super_admin' && actualRole !== 'editor' && actualRole !== 'verifier') {
      return Response.json(
        { error: 'You do not have permission to manage song aliases' },
        { status: 403 }
      );
    }

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id: pendingSongId } = parsedParams.data;

    const parsed = await validateBody(request, addAliasSchema);
    if (!parsed.ok) return parsed.response;
    const { canonicalSongId, aliasTitle } = parsed.data;

    const cleanCanonicalId = String(canonicalSongId).trim();

    // Verify pending song exists
    const pendingSong = await SongModel.findById(pendingSongId);
    if (!pendingSong) {
      return Response.json({ error: 'Pending song not found' }, { status: 404 });
    }

    // Verify canonical song exists
    const canonicalSong = await SongModel.findById(cleanCanonicalId);
    if (!canonicalSong) {
      return Response.json({ error: 'Canonical (existing) song not found' }, { status: 404 });
    }

    const collection = await getCollection(COLLECTIONS.SONGS);

    // Add alias to the canonical song (avoid duplicates)
    const normalizedAlias = aliasTitle.trim();
    await collection.updateOne(
      { _id: new ObjectId(cleanCanonicalId) },
      {
        $addToSet: { aliases: normalizedAlias },
        $set: { updatedAt: new Date() }
      }
    );

    const isPrivateToGlobal =
      !!pendingSong.pendingGlobalVerification && !!pendingSong.organizationId;

    if (isPrivateToGlobal) {
      // Keep the private-library copy; only clear the global-queue flag
      await collection.updateOne(
        { _id: new ObjectId(pendingSongId) },
        {
          $unset: { pendingGlobalVerification: "" },
          $set: {
            verifiedBy: auth.userId,
            verifiedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // Reject the pending duplicate
      await collection.updateOne(
        { _id: new ObjectId(pendingSongId) },
        {
          $set: {
            status: 'rejected',
            verifiedBy: auth.userId,
            verifiedAt: new Date(),
            rejectionReason: `Duplicate of "${canonicalSong.title}" — title added as alias`,
            updatedAt: new Date()
          }
        }
      );
    }

    // Log the action
    await AuditLogModel.log({
      collectionName: COLLECTIONS.SONGS,
      documentId: cleanCanonicalId,
      action: 'add_alias',
      userId: auth.userId,
      itemName: `Alias "${normalizedAlias}" added to "${canonicalSong.title}"`,
    });

    // Invalidate song cache
    appCache.invalidate('songs:');
    appCache.invalidate(`song:${cleanCanonicalId}`);
    appCache.invalidate(`song:${pendingSongId}`);

    return Response.json({
      message: isPrivateToGlobal
        ? `Alias "${normalizedAlias}" added to "${canonicalSong.title}". Private library song kept.`
        : `Alias "${normalizedAlias}" added to "${canonicalSong.title}". Duplicate rejected.`,
      canonicalSong: cleanCanonicalId,
    });
  } catch (error) {
    console.error('Add alias error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
