import { NextRequest } from 'next/server';
import { SettingsModel } from '@/server/models/settings';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
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

    const body = await request.json();
    const updatedSettings = await SettingsModel.updateSettings(body);
    return Response.json(updatedSettings);
  } catch (error) {
    console.error('Update settings error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

