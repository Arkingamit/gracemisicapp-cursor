
import { OrganizationModel } from '../models/organization';
import { OrganizationInput, OrganizationUpdateInput } from '@/lib/types';

export async function getOrganizations(filters = {}, page = 1, limit = 20) {
  try {
    return await OrganizationModel.list(filters, page, limit);
  } catch (error) {
    console.error("Get organizations error:", error);
    throw error;
  }
}

export async function getOrganization(id: string) {
  try {
    const org = await OrganizationModel.findById(id);
    if (!org) {
      throw new Error('Organization not found');
    }
    return org;
  } catch (error) {
    console.error("Get organization error:", error);
    throw error;
  }
}

export async function createOrganization(orgData: OrganizationInput, createdBy: string) {
  try {
    return await OrganizationModel.create(orgData, createdBy);
  } catch (error) {
    console.error("Create organization error:", error);
    throw error;
  }
}

export async function updateOrganization(id: string, updates: OrganizationUpdateInput) {
  try {
    const org = await OrganizationModel.update(id, updates);
    if (!org) {
      throw new Error('Organization not found');
    }
    return org;
  } catch (error) {
    console.error("Update organization error:", error);
    throw error;
  }
}

export async function deleteOrganization(id: string) {
  try {
    const success = await OrganizationModel.delete(id);
    if (!success) {
      throw new Error('Failed to delete organization');
    }
    return { success };
  } catch (error) {
    console.error("Delete organization error:", error);
    throw error;
  }
}

export async function addMemberToOrganization(orgId: string, userId: string) {
  try {
    const org = await OrganizationModel.addMember(orgId, userId);
    if (!org) {
      throw new Error('Organization not found');
    }
    return org;
  } catch (error) {
    console.error("Add member to organization error:", error);
    throw error;
  }
}

export async function removeMemberFromOrganization(orgId: string, userId: string) {
  try {
    const org = await OrganizationModel.removeMember(orgId, userId);
    if (!org) {
      throw new Error('Organization not found');
    }
    return org;
  } catch (error) {
    console.error("Remove member from organization error:", error);
    throw error;
  }
}
