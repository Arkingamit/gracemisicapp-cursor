import { NextRequest } from 'next/server';
import { SettingsModel } from '@/server/models/settings';
import { getAuthUser } from '@/lib/auth';
import { UserModel } from '@/server/models/user';
import { invalidateRateLimitConfig } from '@/server/rateLimit';
import { validateBody } from '@/server/validation/http';
import { systemSettingsUpdateSchema } from '@/server/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await UserModel.findById(auth.userId);
    const role = dbUser?.role || auth.role;
    if (role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await SettingsModel.getSettings();
    return Response.json({ settings });
  } catch (error) {
    console.error('Fetch admin settings error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await UserModel.findById(auth.userId);
    const role = dbUser?.role || auth.role;
    if (role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const parsed = await validateBody(request, systemSettingsUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const settings = await SettingsModel.updateSettings(parsed.data);
    invalidateRateLimitConfig();
    return Response.json({ settings });
  } catch (error) {
    console.error('Update admin settings error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
