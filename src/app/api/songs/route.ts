import { NextRequest } from 'next/server';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { AuditLogModel } from '@/server/models/auditLog';
import { SettingsModel } from '@/server/models/settings';
import { OrganizationModel } from '@/server/models/organization';
import { UserModel } from '@/server/models/user';

import { appCache } from '@/server/cache';
import { compressedJson } from '@/server/compress';
import {
  isUserRestrictedFromSubmitting,
  countSubmissionsToday,
} from '@/server/utils/spamDetection';
import { hasAnyRole } from '@/lib/roles';
import { enforceRateLimit } from '@/server/rateLimit';
import { z } from 'zod';
import { validateBody, validateQuery } from '@/server/validation/http';
import {
  boundedString,
  genreInput,
  objectId,
  songFormatEnum,
  songStatusEnum,
  SONG_TITLE_MAX,
  SONG_ARTIST_MAX,
  SONG_LANGUAGE_MAX,
  SONG_LYRICS_MAX,
} from '@/server/validation/schemas';

const songsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    globalLimit: z.coerce.number().int().min(0).max(100000).optional(),
    orgLimit: z.coerce.number().int().min(0).max(100000).optional(),
    genre: z.string().max(50).optional(),
    artist: z.string().max(100).optional(),
    status: z.string().max(20).optional(),
  })
  .strict();

const songCreateSchema = z
  .object({
    title: boundedString(SONG_TITLE_MAX),
    artist: boundedString(SONG_ARTIST_MAX),
    language: boundedString(SONG_LANGUAGE_MAX),
    genre: genreInput,
    lyrics: z.string().max(SONG_LYRICS_MAX).optional().default(''),
    originalKey: z.string().trim().max(20).optional(),
    externalUrl: z.union([z.literal(''), z.string().trim().url().max(2048)]).optional(),
    format: songFormatEnum.optional(),
    keywords: z.array(boundedString(50)).max(50).optional(),
    // Server-authoritative fields — accepted but overridden below.
    createdBy: objectId.optional(),
    organizationId: objectId.optional(),
    status: songStatusEnum.optional(),
    pendingGlobalVerification: z.boolean().optional(),
  })
  .strict();

// GET /api/songs - List songs (global + user's org songs)
export async function GET(request: NextRequest) {
  try {
    const queryCheck = validateQuery(request, songsQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const globalLimit = searchParams.has('globalLimit') ? parseInt(searchParams.get('globalLimit')!) : undefined;
    const orgLimit = searchParams.has('orgLimit') ? parseInt(searchParams.get('orgLimit')!) : undefined;
    const genre = searchParams.get('genre') || undefined;
    const artist = searchParams.get('artist') || undefined;
    
    // Status filter: default to 'approved' for normal users
    let statusFilter = searchParams.get('status') || 'approved';

    // Check auth to determine org-based filtering
    const auth = getAuthUser(request);

    // Moderate limit for anonymous browsing; looser (per-user) once signed in.
    const listLimited = await enforceRateLimit(
      request,
      auth
        ? { policy: 'authenticated', bucket: 'songs-list', identifier: auth.userId }
        : { policy: 'public', bucket: 'songs-list' }
    );
    if (listLimited) return listLimited;

    let userOrgIds: string[] | undefined;

    if (auth && auth.role !== 'super_admin') {
      // Fetch user's organizations
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const userOrgs = await orgCollection.find({
        $or: [
          { members: auth.userId },
          { createdBy: auth.userId },
          { managerIds: auth.userId }
        ]
      }).toArray();
      userOrgIds = userOrgs.map(o => o._id.toString());
    } else if (!auth) {
      // Unauthenticated users only see global songs (i.e. no orgs)
      userOrgIds = [];
    }
    // super_admin sees all (userOrgIds stays undefined = no filtering)

    // Security check: only super_admin, editor, and verifier can query non-approved statuses
    if (statusFilter !== 'approved') {
      let hasAccess = false;
      if (auth && hasAnyRole(auth, 'editor', 'verifier')) {
        hasAccess = true;
      } else if (auth) {
        // Check fresh role from DB in case JWT is stale
        const dbUser = await UserModel.findById(auth.userId);
        if (dbUser && hasAnyRole(dbUser, 'editor', 'verifier')) {
          hasAccess = true;
        }
      }
      
      if (!hasAccess) {
        statusFilter = 'approved';
      }
    }

    // Build a cache key based on all query parameters + user context
    const cacheKey = `songs:list:${auth?.userId || 'anon'}:${page}:${limit}:${globalLimit}:${orgLimit}:${genre}:${artist}:${statusFilter}:${(userOrgIds || []).join(',')}`;
    
    // Cache-aside with request coalescing: concurrent misses for the same
    // key share one DB query instead of stampeding MongoDB.
    const wasCached = appCache.get<any[]>(cacheKey) !== null;
    const songs = await appCache.getOrSet(
      cacheKey,
      () =>
        SongModel.list(page, limit, { genre, artist, userOrgIds, globalLimit, orgLimit, status: statusFilter }),
      30
    );

    return compressedJson(request, { songs }, {
      status: 200,
      headers: {
        'X-Cache': wasCached ? 'HIT' : 'MISS',
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('List songs error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/songs - Create a new song
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    // Get fresh user data from DB since JWT might have a stale role
    const dbUser = await UserModel.findById(auth.userId);
    const roleBearer = dbUser || auth;

    // Block restricted (spam) contributors from submitting more songs
    if (!hasAnyRole(roleBearer, 'editor')) {
      const restriction = await isUserRestrictedFromSubmitting(auth.userId);
      if (restriction.restricted) {
        return Response.json({ error: restriction.reason }, { status: 403 });
      }
    }

    // Role check: All authenticated users can create songs now (normal users will be pending for global)

    const parsed = await validateBody(request, songCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Daily submission rate limit (auto spam detection)
    if (!hasAnyRole(roleBearer, 'editor')) {
      const settings = await SettingsModel.getSettings();
      const dailyLimit = settings.max_song_submissions_per_day;
      if (dailyLimit && dailyLimit > 0) {
        const todayCount = await countSubmissionsToday(auth.userId);
        if (todayCount >= dailyLimit) {
          return Response.json(
            {
              error: `Daily submission limit reached (${dailyLimit} songs/day). Please try again tomorrow.`,
            },
            { status: 403 }
          );
        }
      }
    }

    // Global Library check
    let status: 'pending' | 'approved' = 'approved';
    // Editors & verifiers (and super admins) skip the pending queue for global submits
    if (!body.organizationId && !hasAnyRole(roleBearer, 'editor', 'verifier')) {
      // Normal users and managers adding to global library will be marked as pending
      status = 'pending';
    }

    // Private Library check
    if (body.organizationId && !hasAnyRole(roleBearer, 'super_admin')) {
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const { ObjectId } = await import('mongodb');
      const org = await orgCollection.findOne({ _id: new ObjectId(body.organizationId) });
      
      if (!org) {
        return Response.json({ error: 'Organization not found' }, { status: 404 });
      }
      
      const isManager = org.managerIds?.includes(auth.userId) || org.createdBy === auth.userId;
      if (!isManager) {
        return Response.json(
          { error: 'You must be a manager of this organization to add songs to its private library.' },
          { status: 403 }
        );
      }
    }

    const songInput = {
      ...body,
      createdBy: auth.userId,
      status, // Will be pending for non-admins submitting global songs
      // Only meaningful for private-library creates
      pendingGlobalVerification: !!(body.pendingGlobalVerification && body.organizationId),
    };

    if (body.organizationId && !hasAnyRole(roleBearer, 'super_admin')) {
      const org = await OrganizationModel.findById(body.organizationId);
      const settings = await SettingsModel.getSettings();
      const limit = org?.maxCustomSongsLimit ?? settings.max_custom_songs_per_org;
      const songsCollection = await getCollection(COLLECTIONS.SONGS);
      const orgSongCount = await songsCollection.countDocuments({ organizationId: body.organizationId });
      
      if (limit && limit > 0) {
        if (orgSongCount >= limit) {
          return Response.json(
            { error: `This organization has reached the maximum limit of ${limit} custom songs.` },
            { status: 403 }
          );
        }
      }
    }

    const song = await SongModel.create(songInput as Parameters<typeof SongModel.create>[0]);

    // Invalidate all cached song lists
    appCache.invalidate('songs:');

    // Log the creation
    await AuditLogModel.log({
      collectionName: COLLECTIONS.SONGS,
      documentId: song.id,
      action: 'create',
      userId: auth.userId,
      itemName: `${song.title} — ${song.artist}`,
    });

    return Response.json({ song }, { status: 201 });
  } catch (error) {
    console.error('Create song error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

