import { NextRequest } from 'next/server';
import { OrganizationModel } from '@/server/models/organization';
import { GroupModel } from '@/server/models/group';
import { getAuthUser } from '@/lib/auth';

// POST /api/organizations/[id]/instruments — Add a new custom instrument
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json();
    const { instrument } = body;

    if (!instrument || typeof instrument !== 'string' || instrument.trim() === '') {
      return Response.json({ error: 'Valid instrument name required' }, { status: 400 });
    }

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
    const { id } = await params;
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

    const { searchParams } = new URL(request.url);
    const instrument = searchParams.get('instrument');

    if (!instrument || typeof instrument !== 'string') {
      return Response.json({ error: 'Valid instrument name required as query param' }, { status: 400 });
    }

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
