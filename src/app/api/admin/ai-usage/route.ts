import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { AiUsageModel } from '@/server/models/aiUsage';
import { UserModel } from '@/server/models/user';

// GET /api/admin/ai-usage - Get AI token usage stats (super_admin only)
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    if (auth.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can view AI usage' }, { status: 403 });
    }

    const [userSummaries, globalTotals] = await Promise.all([
      AiUsageModel.getUserSummaries(),
      AiUsageModel.getGlobalTotals(),
    ]);

    // Enrich with user names/emails
    const userIds = userSummaries.map((s) => s.userId);
    const users = await Promise.all(userIds.map((id) => UserModel.findById(id)));

    const enrichedSummaries = userSummaries.map((summary, idx) => {
      const user = users[idx];
      return {
        ...summary,
        userName: user?.name || user?.username || 'Unknown',
        userEmail: user?.email || 'Unknown',
      };
    });

    return Response.json({
      summaries: enrichedSummaries,
      globalTotals,
    });
  } catch (error) {
    console.error('AI usage stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
