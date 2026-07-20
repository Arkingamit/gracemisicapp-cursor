import { OrganizationModel } from '@/server/models/organization';
import { GroupModel } from '@/server/models/group';
import { SongModel } from '@/server/models/song';
import { SettingsModel } from '@/server/models/settings';
import { AuditLogModel } from '@/server/models/auditLog';
import { sendNotificationToUsers } from '@/server/utils/pushNotifications';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';

export type OrgCreateAccess = {
  id: string;
  name: string;
  canCreate: boolean;
  role: 'manager' | 'editor' | 'member' | 'super_admin';
};

export function getUserOrgAccess(
  org: Awaited<ReturnType<typeof OrganizationModel.findById>>,
  userId: string,
  isSuperAdmin: boolean
): OrgCreateAccess | null {
  if (!org) return null;
  if (isSuperAdmin) {
    return { id: org.id, name: org.name, canCreate: true, role: 'super_admin' };
  }
  const isManager = org.managerIds?.includes(userId) ?? false;
  const isEditor = (org.editorIds || []).includes(userId);
  const isMember =
    (org.members || []).includes(userId) ||
    org.createdBy === userId ||
    isManager ||
    isEditor;

  if (!isMember) return null;

  return {
    id: org.id,
    name: org.name,
    canCreate: true,
    role: isManager ? 'manager' : isEditor ? 'editor' : 'member',
  };
}

export type CreateSongSetResult =
  | {
      ok: true;
      groupId: string;
      name: string;
      orgName: string;
      songTitles: string[];
      songs: { id: string; title: string }[];
      link: string;
      markdownLink: string;
    }
  | { ok: false; error: string };

export async function createSongSetForUser(params: {
  userId: string;
  isSuperAdmin: boolean;
  name: string;
  organizationId: string;
  songIds: string[];
  notes?: string;
  allowedOrgs: OrgCreateAccess[];
}): Promise<CreateSongSetResult> {
  const { userId, isSuperAdmin, name, organizationId, songIds, allowedOrgs } = params;

  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    return { ok: false, error: 'Song set name is required.' };
  }

  const access = allowedOrgs.find((o) => o.id === organizationId);
  if (!access || !access.canCreate) {
    if (allowedOrgs.length === 0) {
      return {
        ok: false,
        error:
          'You are not in any organization. Join or create an organization first.',
      };
    }
    return {
      ok: false,
      error: `You cannot create a song set in that organization. Choose one of: ${allowedOrgs
        .map((o) => o.name)
        .join(', ')}`,
    };
  }

  const org = await OrganizationModel.findById(organizationId);
  if (!org) {
    return { ok: false, error: 'Organization not found.' };
  }

  if (!isSuperAdmin) {
    const settings = await SettingsModel.getSettings();
    const groupsCollection = await getCollection(COLLECTIONS.GROUPS);
    const userGroupCount = await groupsCollection.countDocuments({ createdBy: userId });
    if (userGroupCount >= settings.max_groups_per_user) {
      return {
        ok: false,
        error: `You have reached the maximum limit of ${settings.max_groups_per_user} song sets.`,
      };
    }
  }

  // Validate all song IDs with one $in query instead of one findById per song
  const uniqueIds = [...new Set((songIds || []).filter(Boolean))];
  const foundSongs = await SongModel.findByIdsLite(uniqueIds);
  const validSongIds = foundSongs.map((s) => s.id);
  const songs = foundSongs.map((s) => ({ id: s.id, title: s.title }));

  if (!isSuperAdmin && validSongIds.length > 0) {
    const settings = await SettingsModel.getSettings();
    const limit = org.maxSongsPerGroupLimit ?? settings.max_songs_per_group;
    if (limit && limit > 0 && validSongIds.length > limit) {
      return {
        ok: false,
        error: `Too many songs. This organization allows at most ${limit} songs per song set.`,
      };
    }
  }

  const group = await GroupModel.create(
    {
      name: trimmedName,
      organizationId,
      members: [userId],
    },
    userId
  );

  // Single batched write instead of one update per song
  await GroupModel.addSongs(group.id, validSongIds);

  await AuditLogModel.log({
    collectionName: COLLECTIONS.GROUPS,
    documentId: group.id,
    action: 'create',
    userId,
    itemName: `${group.name} (in ${org.name}) via AI`,
  });

  // One insertMany for all notification records; pushes run concurrently
  const recipients = (org.members || []).filter((memberId) => memberId !== userId);
  await sendNotificationToUsers(
    recipients,
    'New Song Set Created',
    `A new song set "${group.name}" was created in "${org.name}".`,
    `/organizations/view?id=${org.id}&tab=song-sets&groupId=${group.id}`
  );

  return {
    ok: true,
    groupId: group.id,
    name: group.name,
    orgName: org.name,
    songTitles: songs.map((s) => s.title),
    songs,
    link: `/groups/view?id=${group.id}`,
    markdownLink: `[${group.name}](/groups/view?id=${group.id})`,
  };
}

export async function resolveCreatableOrgs(
  userId: string,
  isSuperAdmin: boolean
): Promise<OrgCreateAccess[]> {
  if (isSuperAdmin) {
    const allOrgs = await OrganizationModel.list({}, 1, 200);
    return (allOrgs || []).map((o) => ({
      id: o.id,
      name: o.name,
      canCreate: true,
      role: 'super_admin' as const,
    }));
  }

  const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
  const userOrgs = await orgCollection
    .find({
      $or: [
        { members: userId },
        { createdBy: userId },
        { managerIds: userId },
        { editorIds: userId },
      ],
    })
    .toArray();

  return userOrgs
    .map((doc) =>
      getUserOrgAccess(OrganizationModel.toOrganization(doc as any), userId, false)
    )
    .filter((o): o is OrgCreateAccess => !!o && o.canCreate);
}
