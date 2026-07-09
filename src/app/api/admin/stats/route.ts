import { NextRequest } from 'next/server';
import { getAuthUser, authError } from '@/lib/auth';
import { getAdminStats } from '@/server/api/admin';

// GET /api/admin/stats - Get admin dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    // Only admins can access stats
    if (auth.role !== 'admin') {
      return authError('Forbidden: admin access required', 403);
    }

    const stats = await getAdminStats();
    return Response.json({ stats });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

