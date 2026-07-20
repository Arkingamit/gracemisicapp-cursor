import { NextRequest } from 'next/server';
import { SettingsModel } from '@/server/models/settings';
import { getAuthUser } from '@/lib/auth';
import { enforceRateLimit, invalidateRateLimitConfig } from '@/server/rateLimit';
import { validateBody } from '@/server/validation/http';
import { systemSettingsUpdateSchema } from '@/server/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, { policy: 'public', bucket: 'settings' });
    if (limited) return limited;

    const settings = await SettingsModel.getSettings();
    return Response.json(settings);
  } catch (error) {
    console.error('Fetch settings error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (auth.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const parsed = await validateBody(request, systemSettingsUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const updatedSettings = await SettingsModel.updateSettings(parsed.data);
    invalidateRateLimitConfig();
    return Response.json(updatedSettings);
  } catch (error) {
    console.error('Update settings error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

