import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PushSubscriptionModel } from '@/server/models/pushSubscription';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody } from '@/server/validation/http';

const subscribeSchema = z
  .object({
    subscription: z
      .object({
        endpoint: z.string().url().max(2048),
        expirationTime: z.number().nullable().optional(),
        keys: z
          .object({
            p256dh: z.string().min(1).max(500),
            auth: z.string().min(1).max(500),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const parsed = await validateBody(request, subscribeSchema);
    if (!parsed.ok) return parsed.response;
    const { subscription } = parsed.data;

    await PushSubscriptionModel.upsert(
      auth.userId,
      subscription as Parameters<typeof PushSubscriptionModel.upsert>[1]
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
