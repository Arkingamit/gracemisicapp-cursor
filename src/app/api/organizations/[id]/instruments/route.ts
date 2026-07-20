import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { GroupModel } from '@/server/models/group';
import { getAuthUser } from '@/lib/auth';
import { validateBody, validateParams, validateQuery } from '@/server/validation/http';
import { objectId, boundedString } from '@/server/validation/schemas';

const idParamsSchema = z.object({ id: objectId });
const instrumentBodySchema = z.object({ instrument: boundedString(60) }).strict();
const instrumentQuerySchema = z.object({ instrument: boundedString(60) }).strict();

// POST /api/organizations/[id]/instruments — Add a new custom instrument
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationModel.findById(id);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    const isManager = org.managerIds.includes(auth.userId);
    const isSuperAdmin = auth.role === 'super_admin';

    if (!isManager && !isSuperAdmin) {
      return Response.json({ error: 'Forbidden: Manager access required' }, { status: 403 });
    }

    const parsed = await validateBody(request, instrumentBodySchema);
    if (!parsed.ok) return parsed.response;
    const { instrument } = parsed.data;

    const cleanInstrument = instrument.trim();
    const currentInstruments = org.customInstruments || [];

    if (currentInstruments.includes(cleanInstrument)) {
      return Response.json({ error: 'Instrument already exists' }, { status: 400 });
    }

    // Since we don't have a specific append method, we'll use the generic update method
    const updatedInstruments = [...currentInstruments, cleanInstrument];
    const updatedOrg = await OrganizationModel.update(id, { customInstruments: updatedInstruments } as any);

    return Response.json({ organization: updatedOrg });
  } catch (error) {
    console.error('Add instrument error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/instruments — Remove a custom instrument
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationModel.findById(id);
    if (!org) {
      return Response.json({ error: 'Organization not found' }, { status: 404 });
    }

    const isManager = org.managerIds.includes(auth.userId);
    const isSuperAdmin = auth.role === 'super_admin';

    if (!isManager && !isSuperAdmin) {
      return Response.json({ error: 'Forbidden: Manager access required' }, { status: 403 });
    }

    const queryCheck = validateQuery(request, instrumentQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;
    const { instrument } = queryCheck.data;

    // Safety Check: Is it assigned anywhere in the org?
    const inUse = await GroupModel.isInstrumentInUse(id, instrument);
    if (inUse) {
      return Response.json(
        { error: `Cannot remove "${instrument}" because it is currently assigned to one or more musicians in your song sets.` },
        { status: 400 }
      );
    }

    const currentInstruments = org.customInstruments || [];
    const updatedInstruments = currentInstruments.filter(i => i !== instrument);

    // If it wasn't there to begin with, just return success
    if (currentInstruments.length === updatedInstruments.length) {
      return Response.json({ organization: org });
    }

    const updatedOrg = await OrganizationModel.update(id, { customInstruments: updatedInstruments } as any);

    return Response.json({ organization: updatedOrg });
  } catch (error) {
    console.error('Delete instrument error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
