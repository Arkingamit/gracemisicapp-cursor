import { NextRequest } from 'next/server';
import { FeedbackModel } from '@/server/models/feedback';
import { getAuthUser, authError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authPayload = getAuthUser(request);
    if (!authPayload) {
      return authError('Not authenticated');
    }

    const { type, message } = await request.json();

    if (!type || !message) {
      return Response.json({ error: 'Type and message are required' }, { status: 400 });
    }

    if (!['question', 'bug', 'general', 'idea'].includes(type)) {
      return Response.json({ error: 'Invalid feedback type' }, { status: 400 });
    }

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
