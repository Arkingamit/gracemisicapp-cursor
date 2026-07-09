import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Organization, OrganizationInput, OrganizationUpdateInput, MongoOrganization } from '@/lib/types';

const generateJoinCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export class OrganizationModel {
  // Convert MongoDB document to application Organization type
  static toOrganization(doc: MongoOrganization): Organization {
    // Handling legacy managerId bridging
    const managerIds = doc.managerIds || [];
    if (doc.managerId && !managerIds.includes(doc.managerId)) {
      managerIds.push(doc.managerId);
    }
    // If no managers at all, assign creator as manager
    if (managerIds.length === 0 && doc.createdBy) {
      managerIds.push(doc.createdBy);
    }

    return {
      id: doc._id.toString(),
      name: doc.name,
      createdBy: doc.createdBy,
      managerIds: managerIds,
      editorIds: doc.editorIds || [],
      createdAt: doc.createdAt.toISOString(),
      members: doc.members || [],
      groups: doc.groups || [],
      maxMembersLimit: doc.maxMembersLimit,
      maxSongsPerGroupLimit: doc.maxSongsPerGroupLimit,
      maxCustomSongsLimit: doc.maxCustomSongsLimit,
      customInstruments: doc.customInstruments,
      musicianStatsVisibility: doc.musicianStatsVisibility || 'all',
      statsDataRetentionMonths: doc.statsDataRetentionMonths || null,
      joinCode: doc.joinCode
    };
  }

  // Find an organization by ID
  static async findById(id: string): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const result = await collection.findOne({ _id: new ObjectId(id) });
      return result ? this.toOrganization(result as MongoOrganization) : null;
    } catch (error) {
      console.error("Error finding organization by ID:", error);
      throw error;
    }
  }

  // Find an organization by join code
  static async findByJoinCode(joinCode: string): Promise<Organization | null> {
    try {
      if (!joinCode) return null;
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const result = await collection.findOne({ joinCode: joinCode.toUpperCase() });
      return result ? this.toOrganization(result as MongoOrganization) : null;
    } catch (error) {
      console.error("Error finding organization by join code:", error);
      throw error;
    }
  }

  // Create a new organization
  static async create(orgInput: OrganizationInput, createdBy: string): Promise<Organization> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const now = new Date();
      
      // Make sure creator is included in members
      const members = [...new Set([...orgInput.members, createdBy])];
      
      const managerIds = orgInput.managerIds || [createdBy];
      const editorIds = orgInput.editorIds || [];
      
      // Generate a unique join code
      let joinCode = '';
      let isUnique = false;
      while (!isUnique) {
        joinCode = generateJoinCode();
        const existing = await collection.findOne({ joinCode });
        if (!existing) {
          isUnique = true;
        }
      }

      const newOrg = {
        name: orgInput.name,
        members,
        groups: [],
        createdBy,
        managerIds,
        editorIds,
        createdAt: now,
        updatedAt: now,
        customInstruments: [],
        joinCode
      };
      
      const result = await collection.insertOne(newOrg);
      return {
        id: result.insertedId.toString(),
        name: orgInput.name,
        members,
        groups: [],
        createdBy,
        managerIds,
        editorIds,
        createdAt: now.toISOString(),
        customInstruments: [],
        musicianStatsVisibility: 'all',
        statsDataRetentionMonths: null,
        joinCode
      };
    } catch (error) {
      console.error("Error creating organization:", error);
      throw error;
    }
  }

  // Update an organization
  static async update(id: string, updates: OrganizationUpdateInput): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      const updateDoc = {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      };
      
      await collection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      
      return await this.findById(id);
    } catch (error) {
      console.error("Error updating organization:", error);
      throw error;
    }
  }

  // Delete an organization
  static async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      // Get all groups belonging to this organization
      const groupCollection = await getCollection(COLLECTIONS.GROUPS);
      const groups = await groupCollection.find({ organizationId: id }).toArray();
      const groupIds = groups.map(g => g._id.toString());
      
      // Delete all groups belonging to this organization
      await groupCollection.deleteMany({ organizationId: id });
      
      // Delete all messages for groups in this organization
      const messageCollection = await getCollection(COLLECTIONS.MESSAGES);
      await messageCollection.deleteMany({ groupId: { $in: groupIds } });
      
      // Delete the organization
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting organization:", error);
      throw error;
    }
  }

  // Add a member to an organization
  static async addMember(orgId: string, userId: string): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      await collection.updateOne(
        { _id: new ObjectId(orgId) },
        { 
          $addToSet: { members: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(orgId);
    } catch (error) {
      console.error("Error adding member to organization:", error);
      throw error;
    }
  }

  // Remove a member from an organization
  static async removeMember(orgId: string, userId: string): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      await collection.updateOne(
        { _id: new ObjectId(orgId) },
        { 
          $pull: { members: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      // Also remove this user from all groups in this organization
      const groupCollection = await getCollection(COLLECTIONS.GROUPS);
      await groupCollection.updateMany(
        { organizationId: orgId },
        { $pull: { members: userId } }
      );
      
      return await this.findById(orgId);
    } catch (error) {
      console.error("Error removing member from organization:", error);
      throw error;
    }
  }

  // List organizations with filters
  static async list(
    filters: { 
      memberId?: string,
      createdBy?: string
    } = {},
    page = 1, 
    limit = 20
  ): Promise<Organization[]> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const skip = (page - 1) * limit;
      
      // Build query from filters
      const query: any = {};
      if (filters.memberId) {
        query.$or = [
          { members: filters.memberId },
          { managerIds: filters.memberId },
          { managerId: filters.memberId } // legacy backward compat
        ];
      }
      if (filters.createdBy) query.createdBy = filters.createdBy;
      
      const results = await collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      return results.map(doc => this.toOrganization(doc as MongoOrganization));
    } catch (error) {
      console.error("Error listing organizations:", error);
      throw error;
    }
  }

  // Add a manager to an organization
  static async addManager(orgId: string, userId: string): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      await collection.updateOne(
        { _id: new ObjectId(orgId) },
        { 
          $addToSet: { managerIds: userId, members: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(orgId);
    } catch (error) {
      console.error("Error adding manager:", error);
      throw error;
    }
  }

  // Remove a manager role from an organization
  static async removeManagerRole(orgId: string, userId: string): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      await collection.updateOne(
        { _id: new ObjectId(orgId) },
        { 
          $pull: { managerIds: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(orgId);
    } catch (error) {
      console.error("Error removing manager role:", error);
      throw error;
    }
  }

  // Add an editor to an organization
  static async addEditor(orgId: string, userId: string): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      await collection.updateOne(
        { _id: new ObjectId(orgId) },
        { 
          $addToSet: { editorIds: userId, members: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(orgId);
    } catch (error) {
      console.error("Error adding editor:", error);
      throw error;
    }
  }

  // Remove an editor role from an organization
  static async removeEditorRole(orgId: string, userId: string): Promise<Organization | null> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      await collection.updateOne(
        { _id: new ObjectId(orgId) },
        { 
          $pull: { editorIds: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(orgId);
    } catch (error) {
      console.error("Error removing editor role:", error);
      throw error;
    }
  }

  // List organizations where a user is a member or manager
  static async listByMember(userId: string): Promise<Organization[]> {
    try {
      const collection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const results = await collection
        .find({
          $or: [
            { members: userId },
            { managerIds: userId },
            { managerId: userId } // legacy
          ]
        })
        .toArray();
      return results.map(doc => this.toOrganization(doc as MongoOrganization));
    } catch (error) {
      console.error("Error listing organizations by member:", error);
      throw error;
    }
  }
}
