import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthUser, authError } from '@/lib/auth';
import { SongReportModel } from '@/server/models/songReport';
import { UserModel } from '@/server/models/user';
import { validateQuery } from '@/server/validation/http';

const reportsQuerySchema = z
  .object({ status: z.enum(['all', 'new', 'reviewed', 'dismissed']).optional() })
  .strict();

// GET /api/admin/song-reports
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return authError('Not authenticated');

    const dbUser = await UserModel.findById(auth.userId);
    const role = dbUser?.role || auth.role;
    if (role !== 'super_admin' && role !== 'editor') {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const queryCheck = validateQuery(request, reportsQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    const reports = await SongReportModel.list(status);
    return Response.json({ reports });
  } catch (error) {
    console.error('List song reports error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
