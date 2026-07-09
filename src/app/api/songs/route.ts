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

// GET /api/songs - List songs (global + user's org songs)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const globalLimit = searchParams.has('globalLimit') ? parseInt(searchParams.get('globalLimit')!) : undefined;
    const orgLimit = searchParams.has('orgLimit') ? parseInt(searchParams.get('orgLimit')!) : undefined;
    const genre = searchParams.get('genre') || undefined;
    const artist = searchParams.get('artist') || undefined;

    // Check auth to determine org-based filtering
    const auth = getAuthUser(request);
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

    // Build a cache key based on all query parameters + user context
    const cacheKey = `songs:list:${auth?.userId || 'anon'}:${page}:${limit}:${globalLimit}:${orgLimit}:${genre}:${artist}:${(userOrgIds || []).join(',')}`;
    
    // Check cache first
    const cached = appCache.get<any[]>(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ songs: cached }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      });
    }

    const songs = await SongModel.list(page, limit, { genre, artist, userOrgIds, globalLimit, orgLimit });
    
    // Store in cache for 30 seconds
    appCache.set(cacheKey, songs, 30);

    return new Response(JSON.stringify({ songs }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
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
    const actualRole = dbUser?.role || auth.role;

    // Role check: Only super_admin, editor, or manager can create songs
    const allowedRoles = ['super_admin', 'editor', 'manager'];
    if (!allowedRoles.includes(actualRole)) {
      return Response.json(
        { error: 'Only administrators, editors, or managers can create songs' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Managers MUST create songs within an org they manage OR as a global song
    if (actualRole === 'manager' && body.organizationId) {
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const { ObjectId } = await import('mongodb');
      const org = await orgCollection.findOne({ _id: new ObjectId(body.organizationId) });
      if (!org) {
        return Response.json({ error: 'Organization not found' }, { status: 404 });
      }
      if (!org.managerIds?.includes(auth.userId) && org.createdBy !== auth.userId) {
        return Response.json(
          { error: 'You must be the manager of this organization to add songs to it' },
          { status: 403 }
        );
      }
    }

    // For non-managers: if organizationId is set, validate membership
    if (body.organizationId && actualRole !== 'manager') {
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const { ObjectId } = await import('mongodb');
      const org = await orgCollection.findOne({ _id: new ObjectId(body.organizationId) });
      if (!org) {
        return Response.json({ error: 'Organization not found' }, { status: 404 });
      }
      const isMember = org.members?.includes(auth.userId) ||
                        org.createdBy === auth.userId ||
                        (org.managerIds && org.managerIds.includes(auth.userId)) ||
                        actualRole === 'super_admin';
      if (!isMember) {
        return Response.json({ error: 'You must be a member of this organization' }, { status: 403 });
      }
    }

    const songInput = {
      ...body,
      createdBy: auth.userId,
    };

    if (body.organizationId && auth.role !== 'super_admin') {
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

    const song = await SongModel.create(songInput);

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

