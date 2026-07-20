import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser, authError } from '@/lib/auth';
import { UserModel } from '@/server/models/user';
import { OrganizationModel } from '@/server/models/organization';
import { DeviceTokenModel } from '@/server/models/deviceToken';
import { SYSTEM_ADMIN_EMAIL } from '@/lib/constants';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';

/**
 * DELETE /api/auth/delete-account
 * Lets the signed-in user permanently delete their own account (store compliance).
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const user = await UserModel.findById(auth.userId);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.email === SYSTEM_ADMIN_EMAIL) {
      return Response.json(
        { error: 'The system admin account cannot be deleted.' },
        { status: 400 }
      );
    }

    // Block if user is the only manager of any organization
    const orgs = await OrganizationModel.listByMember(auth.userId);
    for (const org of orgs) {
      const managers = org.managerIds || [];
      if (managers.includes(auth.userId) && managers.length <= 1) {
        return Response.json(
          {
            error: `You are the only manager of "${org.name}". Transfer management to someone else before deleting your account.`,
          },
          { status: 400 }
        );
      }
    }

    const userId = auth.userId;

    // Remove membership / roles from organizations
    const orgsCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
    await orgsCollection.updateMany(
      {},
      {
        $pull: {
          members: userId,
          managerIds: userId,
          editorIds: userId,
        },
      } as any
    );

    // Personal data cleanup
    await DeviceTokenModel.removeByUserId(userId);

    const [
      favorites,
      playlists,
      notifications,
      pushSubs,
      chatHistory,
      joinRequests,
      feedback,
      aiUsage,
    ] = await Promise.all([
      getCollection(COLLECTIONS.FAVORITES),
      getCollection(COLLECTIONS.PLAYLISTS),
      getCollection(COLLECTIONS.NOTIFICATIONS),
      getCollection(COLLECTIONS.PUSH_SUBSCRIPTIONS),
      getCollection(COLLECTIONS.CHAT_HISTORY),
      getCollection(COLLECTIONS.JOIN_REQUESTS),
      getCollection(COLLECTIONS.FEEDBACK),
      getCollection(COLLECTIONS.AI_USAGE),
    ]);

    await Promise.all([
      favorites.deleteMany({ userId }),
      playlists.deleteMany({ userId }),
      notifications.deleteMany({ userId }),
      pushSubs.deleteMany({ userId }),
      chatHistory.deleteMany({ userId }),
      joinRequests.deleteMany({ userId }),
      feedback.deleteMany({ userId }),
      aiUsage.deleteMany({ userId }),
    ]);

    const deleted = await UserModel.delete(userId);
    if (!deleted) {
      return Response.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    const cookieStore = await cookies();
    cookieStore.delete('token');

    return Response.json({
      success: true,
      message: 'Your account has been permanently deleted.',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
