export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { PayoutModel } from '@/server/models/payout';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    if (auth.role !== 'super_admin' && auth.role !== 'editor') {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 });
    }

    const songsCollection = await getCollection(COLLECTIONS.SONGS);
    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const auditCollection = await getCollection(COLLECTIONS.AUDIT_LOGS);

    // Fetch all users
    const users = await usersCollection.find({}).toArray();
    
    // Initialize ledger map keyed by user ID string
    const ledger = new Map<string, any>();
    
    users.forEach(u => {
      const id = u._id.toString();
      ledger.set(id, {
        userId: id,
        name: u.name || u.displayName || 'Unknown User',
        email: u.email || '',
        role: u.role || 'user',
        songsSubmitted: 0,
        songsVerified: 0,
        aliasesAdded: 0,
        earnedPoints: 0,
        paidPoints: 0,
        totalPoints: 0,
        submittedItems: [],
        verifiedItems: [],
        aliasItems: [],
      });
    });

    // 1. Aggregate Songs Submitted
    const submittedSongs = await songsCollection.aggregate([
      { $match: { status: 'approved' } },
      { $group: { 
          _id: "$createdBy", 
          count: { $sum: 1 },
          items: { $push: { id: "$_id", title: "$title", date: "$createdAt", verifiedBy: "$verifiedBy" } }
        } 
      }
    ]).toArray();

    submittedSongs.forEach(stat => {
      if (!stat._id) return;
      const uid = stat._id.toString();
      if (ledger.has(uid)) {
        ledger.get(uid).songsSubmitted += stat.count;
        ledger.get(uid).submittedItems.push(...stat.items);
      }
    });

    // 2. Aggregate Songs Verified
    const verifiedSongs = await songsCollection.aggregate([
      { $match: { verifiedBy: { $ne: null }, status: 'approved' } },
      { $group: { 
          _id: "$verifiedBy", 
          count: { $sum: 1 },
          items: { $push: { id: "$_id", title: "$title", date: "$verifiedAt", createdBy: "$createdBy" } }
        } 
      }
    ]).toArray();

    verifiedSongs.forEach(stat => {
      if (!stat._id) return;
      const uid = stat._id.toString();
      if (ledger.has(uid)) {
        ledger.get(uid).songsVerified += stat.count;
        ledger.get(uid).verifiedItems.push(...stat.items);
      }
    });

    // 3. Aggregate Aliases Added
    const aliasLogs = await auditCollection.aggregate([
      { $match: { action: 'add_alias' } },
      { $group: { 
          _id: "$userId", 
          count: { $sum: 1 },
          items: { $push: { id: "$documentId", title: "$itemName", date: "$timestamp" } }
        } 
      }
    ]).toArray();

    aliasLogs.forEach(stat => {
      if (!stat._id) return;
      const uid = stat._id.toString();
      if (ledger.has(uid)) {
        ledger.get(uid).aliasesAdded += stat.count;
        ledger.get(uid).aliasItems.push(...stat.items);
      }
    });

    // 4. Points already paid out
    const paidByUser = await PayoutModel.getPaidPointsByUser();

    const POINTS_PER_SUBMIT = 10;
    const POINTS_PER_VERIFY = 5;
    const POINTS_PER_ALIAS = 2;

    const activityData = Array.from(ledger.values())
      .filter(user => user.songsSubmitted > 0 || user.songsVerified > 0 || user.aliasesAdded > 0 || (paidByUser.get(user.userId) || 0) > 0)
      .map(user => {
        const earned =
          (user.songsSubmitted * POINTS_PER_SUBMIT) +
          (user.songsVerified * POINTS_PER_VERIFY) +
          (user.aliasesAdded * POINTS_PER_ALIAS);
        const paid = paidByUser.get(user.userId) || 0;

        user.earnedPoints = earned;
        user.paidPoints = paid;
        // Remaining balance after payouts (never negative)
        user.totalPoints = Math.max(0, earned - paid);

        user.submittedItems.forEach((item: any) => {
          if (item.verifiedBy) {
            const verifier = ledger.get(item.verifiedBy.toString());
            item.verifiedByName = verifier?.name || 'Unknown Verifier';
            item.verifiedByEmail = verifier?.email || '';
          }
        });
        user.verifiedItems.forEach((item: any) => {
          if (item.createdBy) {
            const submitter = ledger.get(item.createdBy.toString());
            item.createdByName = submitter?.name || 'Unknown Submitter';
            item.createdByEmail = submitter?.email || '';
          }
        });

        return user;
      });

    activityData.sort((a, b) => b.totalPoints - a.totalPoints);

    return Response.json({
      success: true,
      data: activityData,
      pointSystem: {
        submit: POINTS_PER_SUBMIT,
        verify: POINTS_PER_VERIFY,
        alias: POINTS_PER_ALIAS
      }
    });
  } catch (error) {
    console.error('Error fetching activity ledger:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
