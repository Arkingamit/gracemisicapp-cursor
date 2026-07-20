import { NextRequest } from 'next/server';
import { z } from 'zod';
import { FeedbackModel } from '@/server/models/feedback';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody } from '@/server/validation/http';
import { feedbackTypeEnum, boundedString } from '@/server/validation/schemas';

const feedbackSchema = z
  .object({ type: feedbackTypeEnum, message: boundedString(5000) })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const authPayload = getAuthUser(request);
    if (!authPayload) {
      return authError('Not authenticated');
    }

    const parsed = await validateBody(request, feedbackSchema);
    if (!parsed.ok) return parsed.response;
    const { type, message } = parsed.data;

    // Since we don't store userName in authPayload, we'll fetch it or just use email/id
    // But getAuthUser might just have userId and email. Let's use what we have.
    const userName = authPayload.email || 'User'; 

    const feedback = await FeedbackModel.create({
      userId: authPayload.userId,
      userName: userName,
      type,
      message
    });

    return Response.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error('Feedback creation error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
