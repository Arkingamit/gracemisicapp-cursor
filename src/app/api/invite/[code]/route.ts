import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { enforceRateLimit } from '@/server/rateLimit';
import { validateParams } from '@/server/validation/http';

const codeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, { message: 'invalid join code format' }),
});

// GET /api/invite/[code]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const limited = await enforceRateLimit(request, { policy: 'public', bucket: 'invite' });
    if (limited) return limited;

    const parsedParams = validateParams(await params, codeParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const code = parsedParams.data.code.toUpperCase();

    // We need a specific method to fetch org name by join code securely
    const organization = await OrganizationModel.findByJoinCodePublic(code);

    if (!organization) {
      return Response.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    return Response.json({
      organization: {
        id: organization._id?.toString(),
        name: organization.name,
        joinCode: organization.joinCode,
      }
    });
  } catch (error) {
    console.error('Fetch invite error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
