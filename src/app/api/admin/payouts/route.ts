export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { PayoutModel } from '@/server/models/payout';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { validateBody, validateQuery } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';

const payoutSchema = z
  .object({
    userId: objectId,
    points: z.coerce.number().int().positive().max(10_000_000),
    note: z.string().max(1000).optional(),
  })
  .strict();

const payoutQuerySchema = z.object({ userId: objectId }).strict();

/**
 * POST /api/admin/payouts
 * Record a payout that subtracts points from a user's remaining balance.
 * Body: { userId: string, points: number, note?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');
    if (auth.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only super admins can record payouts' }), { status: 403 });
    }

    const parsed = await validateBody(request, payoutSchema);
    if (!parsed.ok) return parsed.response;
    const userId = parsed.data.userId.trim();
    const points = parsed.data.points;
    const note = parsed.data.note?.trim();

    const usersCollection = await getCollection(COLLECTIONS.USERS);
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Recompute remaining balance so we never overpay
    const songsCollection = await getCollection(COLLECTIONS.SONGS);
    const auditCollection = await getCollection(COLLECTIONS.AUDIT_LOGS);

    const POINTS_PER_SUBMIT = 10;
    const POINTS_PER_VERIFY = 5;
    const POINTS_PER_ALIAS = 2;

    const [submitted, verified, aliases, paidByUser] = await Promise.all([
      songsCollection.countDocuments({ status: 'approved', createdBy: userId }),
      songsCollection.countDocuments({ status: 'approved', verifiedBy: userId }),
      auditCollection.countDocuments({ action: 'add_alias', userId }),
      PayoutModel.getPaidPointsByUser(),
    ]);

    const earned =
      submitted * POINTS_PER_SUBMIT +
      verified * POINTS_PER_VERIFY +
      aliases * POINTS_PER_ALIAS;
    const alreadyPaid = paidByUser.get(userId) || 0;
    const remaining = Math.max(0, earned - alreadyPaid);

    if (points > remaining) {
      return new Response(
        JSON.stringify({
          error: `Cannot pay ${points} points. Remaining balance is ${remaining}.`,
          remaining,
          earned,
          paid: alreadyPaid,
        }),
        { status: 400 }
      );
    }

    const payout = await PayoutModel.create({
      userId,
      points,
      note,
      paidBy: auth.userId,
      paidByName: auth.email,
    });

    const newRemaining = remaining - points;

    return Response.json({
      success: true,
      payout,
      balance: {
        earned,
        paid: alreadyPaid + points,
        remaining: newRemaining,
      },
    });
  } catch (error) {
    console.error('Error recording payout:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

/**
 * GET /api/admin/payouts?userId=...
 * List payout history for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');
    if (auth.role !== 'super_admin' && auth.role !== 'editor') {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 });
    }

    const queryCheck = validateQuery(request, payoutQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;
    const { userId } = queryCheck.data;

    const payouts = await PayoutModel.listForUser(userId);
    return Response.json({ success: true, payouts });
  } catch (error) {
    console.error('Error listing payouts:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
