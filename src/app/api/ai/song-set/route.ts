import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, authError } from '@/lib/auth';
import {
  createSongSetForUser,
  resolveCreatableOrgs,
} from '@/server/utils/createSongSet';
import { validateBody } from '@/server/validation/http';
import { boundedString, objectId, objectIdArray, NAME_MAX } from '@/server/validation/schemas';

const aiSongSetSchema = z
  .object({
    name: boundedString(NAME_MAX),
    organizationId: objectId,
    songIds: objectIdArray.max(2000).optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return authError('Not authenticated');

    const parsed = await validateBody(req, aiSongSetSchema);
    if (!parsed.ok) return parsed.response;
    const name = parsed.data.name;
    const organizationId = parsed.data.organizationId;
    const songIds = parsed.data.songIds ?? [];
    const notes = parsed.data.notes;

    const isSuperAdmin = auth.role === 'super_admin';
    const allowedOrgs = await resolveCreatableOrgs(auth.userId, isSuperAdmin);

    const result = await createSongSetForUser({
      userId: auth.userId,
      isSuperAdmin,
      name,
      organizationId,
      songIds,
      notes,
      allowedOrgs,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({
      group: {
        id: result.groupId,
        name: result.name,
        orgName: result.orgName,
        songTitles: result.songTitles,
        link: result.link,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('AI create song set error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
