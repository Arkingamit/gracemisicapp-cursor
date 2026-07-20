import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { SettingsModel } from '../models/settings';
import { SongReportModel } from '../models/songReport';
import { sendNotificationToUser } from './pushNotifications';
import { SpamFlagSource, ModerationStatus } from '@/lib/spamReportCategories';
import { SYSTEM_ADMIN_EMAIL } from '@/lib/constants';

async function notifySuperAdmins(title: string, message: string, link = '/admin/song-reports') {
  try {
    const users = await getCollection(COLLECTIONS.USERS);
    const admins = await users
      .find({ $or: [{ role: 'super_admin' }, { email: SYSTEM_ADMIN_EMAIL }] })
      .project({ _id: 1 })
      .toArray();

    await Promise.all(
      admins.map((admin) =>
        sendNotificationToUser(admin._id.toString(), title, message, link).catch((err) =>
          console.error('Failed to notify admin about spam:', err)
        )
      )
    );
  } catch (error) {
    console.error('Failed to notify super admins:', error);
  }
}

export async function setUserModerationStatus(
  userId: string,
  status: ModerationStatus,
  reason: string,
  source: SpamFlagSource
): Promise<{ updated: boolean; previousStatus: ModerationStatus }> {
  if (!ObjectId.isValid(userId)) {
    return { updated: false, previousStatus: 'ok' };
  }

  const users = await getCollection(COLLECTIONS.USERS);
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) {
    return { updated: false, previousStatus: 'ok' };
  }

  const previousStatus = (user.moderationStatus as ModerationStatus) || 'ok';

  // Never escalate past restricted; don't downgrade restricted via auto-flag
  if (previousStatus === 'restricted' && status !== 'restricted') {
    return { updated: false, previousStatus };
  }

  // Don't re-apply the same status unless reason changed and we're escalating
  if (previousStatus === status) {
    return { updated: false, previousStatus };
  }

  // Escalation order: ok < flagged < restricted
  const rank = { ok: 0, flagged: 1, restricted: 2 };
  if (rank[status] < rank[previousStatus]) {
    return { updated: false, previousStatus };
  }

  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        moderationStatus: status,
        moderationReason: reason,
        moderatedAt: new Date(),
        lastSpamFlagSource: source,
      },
    }
  );

  const name = user.name || user.displayName || user.email || 'A user';
  await notifySuperAdmins(
    status === 'restricted' ? 'Contributor restricted' : 'Contributor flagged',
    `${name} was marked ${status}: ${reason}`,
    '/admin/users'
  );

  return { updated: true, previousStatus };
}

/** After a song is rejected, check if the contributor exceeded the rejection threshold */
export async function checkRejectionThreshold(contributorId: string): Promise<void> {
  if (!contributorId || !ObjectId.isValid(contributorId)) return;

  const settings = await SettingsModel.getSettings();
  const threshold = settings.spam_rejection_threshold;
  if (!threshold || threshold <= 0) return;

  const songs = await getCollection(COLLECTIONS.SONGS);
  const rejectedCount = await songs.countDocuments({
    createdBy: contributorId,
    status: 'rejected',
  });

  if (rejectedCount >= threshold) {
    await setUserModerationStatus(
      contributorId,
      'restricted',
      `Auto-restricted: ${rejectedCount} songs rejected (threshold: ${threshold})`,
      'rejection_threshold'
    );
  }
}

/** After a song report is filed, check public-report threshold for the contributor */
export async function checkSongReportThreshold(contributorId: string): Promise<void> {
  if (!contributorId) return;

  const settings = await SettingsModel.getSettings();
  const threshold = settings.spam_song_report_threshold;
  if (!threshold || threshold <= 0) return;

  const reportCount = await SongReportModel.countReportsAgainstUser(contributorId);
  if (reportCount >= threshold) {
    await setUserModerationStatus(
      contributorId,
      'flagged',
      `Auto-flagged: ${reportCount} unique user reports against their songs (threshold: ${threshold})`,
      'song_report_threshold'
    );
  }
}

/** After a verifier marks someone as a spammer, check user-report threshold */
export async function checkSpammerReportThreshold(contributorId: string): Promise<void> {
  if (!contributorId) return;

  const settings = await SettingsModel.getSettings();
  const threshold = settings.spam_user_report_threshold;
  if (!threshold || threshold <= 0) return;

  const count = await SongReportModel.countSpammerReportsAgainstUser(contributorId);
  if (count >= threshold) {
    await setUserModerationStatus(
      contributorId,
      'restricted',
      `Auto-restricted: reported as spammer ${count} time(s) by verifiers (threshold: ${threshold})`,
      'verifier_report'
    );
  } else if (count > 0) {
    await setUserModerationStatus(
      contributorId,
      'flagged',
      `Flagged: reported as spammer by a verifier (${count}/${threshold})`,
      'verifier_report'
    );
  }
}

export async function isUserRestrictedFromSubmitting(userId: string): Promise<{
  restricted: boolean;
  reason?: string;
}> {
  if (!ObjectId.isValid(userId)) return { restricted: false };
  const users = await getCollection(COLLECTIONS.USERS);
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) return { restricted: false };

  if (user.moderationStatus === 'restricted') {
    return {
      restricted: true,
      reason:
        user.moderationReason ||
        'Your account has been restricted from submitting songs due to spam or quality issues. Contact an admin.',
    };
  }
  return { restricted: false };
}

export async function countSubmissionsToday(userId: string): Promise<number> {
  const songs = await getCollection(COLLECTIONS.SONGS);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return songs.countDocuments({
    createdBy: userId,
    createdAt: { $gte: startOfDay },
  });
}
