import { NextRequest } from 'next/server';
import { z } from 'zod';
import { OrganizationModel } from '@/server/models/organization';
import { SettingsModel } from '@/server/models/settings';
import { getAuthUser, authError } from '@/lib/auth';
import { AuditLogModel } from '@/server/models/auditLog';
import { COLLECTIONS } from '@/server/db/collections';
import { validateBody, validateQuery } from '@/server/validation/http';
import { boundedString, objectId, objectIdArray, NAME_MAX } from '@/server/validation/schemas';

const orgsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    memberId: objectId.optional(),
  })
  .strict();

const orgCreateSchema = z
  .object({
    name: boundedString(NAME_MAX),
    members: objectIdArray.max(5000).optional(),
    managerIds: objectIdArray.max(1000).optional(),
    editorIds: objectIdArray.max(1000).optional(),
    joinCode: z.string().trim().max(20).optional(),
  })
  .strict();

// GET /api/organizations - List all organizations
export async function GET(request: NextRequest) {
  try {
    const queryCheck = validateQuery(request, orgsQuerySchema);
    if (!queryCheck.ok) return queryCheck.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const auth = getAuthUser(request);
    let memberId = searchParams.get('memberId') || undefined;

    // Enforce visibility restriction for non-super-admins
    if (!auth || auth.role !== 'super_admin') {
      if (!auth) return authError('Not authenticated');
      memberId = auth.userId;
    }

    const organizations = await OrganizationModel.list({ memberId }, page, limit);

    // Get all unique member IDs across all organizations
    const allMemberIds = new Set<string>();
    organizations.forEach(org => org.members.forEach(id => allMemberIds.add(id)));

    if (allMemberIds.size > 0) {
      const { getCollection } = await import('@/server/db/connection');
      const { ObjectId } = await import('mongodb');
      const usersCol = await getCollection(COLLECTIONS.USERS);
      
      const validUsers = await usersCol.find({
        _id: { 
          $in: Array.from(allMemberIds)
            .filter(id => {
              try {
                return ObjectId.isValid(id);
              } catch (e) {
                return false;
              }
            })
            .map(id => new ObjectId(id)) 
        },
        role: { $ne: 'super_admin' }
      }).project({ _id: 1 }).toArray();

      const validUserIds = new Set(validUsers.map(u => u._id.toString()));

      organizations.forEach(org => {
        org.members = org.members.filter(id => validUserIds.has(id));
      });
    }

    return Response.json({ organizations });
  } catch (error) {
    console.error('List organizations error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/organizations - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return authError('Not authenticated');
    }

    // Fetch system settings to check permissions
    let allowUserOrgCreation = true;
    try {
      const settings = await SettingsModel.getSettings();
      // Ensure we get a boolean, defaulting to true if something is weird
      allowUserOrgCreation = settings && typeof settings.allow_user_org_creation === 'boolean' 
        ? settings.allow_user_org_creation 
        : true;
    } catch (e) {
      console.error('Failed to fetch settings in POST org, defaulting to true:', e);
    }

    // Check if normal users can create organizations
    if (auth.role !== 'super_admin' && allowUserOrgCreation === false) {
      return Response.json(
        { error: 'Organization creation is currently disabled for normal users by the administrator.' },
        { status: 403 }
      );
    }

    const parsed = await validateBody(request, orgCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Enforce creator as manager and initial member
    const orgData = {
      ...body,
      managerId: auth.userId,
      members: Array.isArray(body.members) ? [...new Set([...body.members, auth.userId])] : [auth.userId],
    };

    const organization = await OrganizationModel.create(
      orgData as Parameters<typeof OrganizationModel.create>[0],
      auth.userId
    );

    // Audit log: Organization created
    await AuditLogModel.log({
      collectionName: COLLECTIONS.ORGANIZATIONS,
      documentId: organization.id,
      action: 'create',
      userId: auth.userId,
      itemName: organization.name,
    });

    return Response.json({ organization }, { status: 201 });
  } catch (error) {
    console.error('Create organization error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

