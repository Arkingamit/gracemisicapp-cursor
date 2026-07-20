import { NextRequest } from 'next/server';
import { z } from 'zod';
import { DeviceTokenModel } from '@/server/models/deviceToken';
import { getAuthUser, authError } from '@/lib/auth';
import { validateBody } from '@/server/validation/http';
import { devicePlatformEnum } from '@/server/validation/schemas';

const registerDeviceSchema = z
  .object({ token: z.string().min(1).max(500), platform: devicePlatformEnum })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    const parsed = await validateBody(request, registerDeviceSchema);
    if (!parsed.ok) return parsed.response;
    const { token, platform } = parsed.data;

    await DeviceTokenModel.upsert(auth.userId, token, platform);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Register device token error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
