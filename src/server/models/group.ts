
import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { Group, GroupInput, GroupUpdateInput, MongoGroup, SongTransposition, MusicianAssignment } from '@/lib/types';

export class GroupModel {
  static toGroup(doc: MongoGroup): Group {
    return {
      id: doc._id.toString(),
      name: doc.name,
      organizationId: doc.organizationId,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt.toISOString(),
      members: doc.members,
      songs: doc.songs || [],
      songTranspositions: doc.songTranspositions || [],
      songEditStates: doc.songEditStates || {},
      musicianAssignments: doc.musicianAssignments || []
    };
  }

  // Find a group by ID
  static async findById(id: string): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      const result = await collection.findOne({ _id: new ObjectId(id) });
      return result ? this.toGroup(result as MongoGroup) : null;
    } catch (error) {
      console.error("Error finding group by ID:", error);
      throw error;
    }
  }

  // Create a new group
  static async create(groupInput: GroupInput, createdBy: string): Promise<Group> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      const now = new Date();
      
      const newGroup = {
        name: groupInput.name,
        organizationId: groupInput.organizationId,
        members: groupInput.members || [],
        songs: [],
        songTranspositions: [],
        createdBy,
        createdAt: now,
        updatedAt: now
      };
      
      const result = await collection.insertOne(newGroup);
      
      // Update the organization to include this group
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      await orgCollection.updateOne(
        { _id: new ObjectId(groupInput.organizationId) },
        { $push: { groups: result.insertedId.toString() } }
      );
      
      return {
        id: result.insertedId.toString(),
        name: groupInput.name,
        organizationId: groupInput.organizationId,
        members: groupInput.members || [],
        songs: [],
        songTranspositions: [],
        createdBy,
        createdAt: now.toISOString()
      };
    } catch (error) {
      console.error("Error creating group:", error);
      throw error;
    }
  }

  // Update a group
  static async update(id: string, updates: GroupUpdateInput): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      
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
      console.error("Error updating group:", error);
      throw error;
    }
  }

  // Delete a group
  static async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      
      // Get the group to find its organization
      const group = await collection.findOne({ _id: new ObjectId(id) });
      if (!group) return false;
      
      // Remove the group reference from the organization
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      await orgCollection.updateOne(
        { _id: new ObjectId(group.organizationId) },
        { $pull: { groups: id } }
      );
      
      // Delete all messages for this group
      const messageCollection = await getCollection(COLLECTIONS.MESSAGES);
      await messageCollection.deleteMany({ groupId: id });
      
      // Delete the group
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount === 1;
    } catch (error) {
      console.error("Error deleting group:", error);
      throw error;
    }
  }

  // Add a song to a group
  static async addSong(groupId: string, songId: string): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      
      await collection.updateOne(
        { _id: new ObjectId(groupId) },
        { 
          $addToSet: { songs: songId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(groupId);
    } catch (error) {
      console.error("Error adding song to group:", error);
      throw error;
    }
  }

  // Add many songs to a group in a single write (one round trip via $each)
  static async addSongs(groupId: string, songIds: string[]): Promise<Group | null> {
    try {
      if (songIds.length === 0) return await this.findById(groupId);
      const collection = await getCollection(COLLECTIONS.GROUPS);

      await collection.updateOne(
        { _id: new ObjectId(groupId) },
        {
          $addToSet: { songs: { $each: songIds } },
          $set: { updatedAt: new Date() }
        }
      );

      return await this.findById(groupId);
    } catch (error) {
      console.error("Error adding songs to group:", error);
      throw error;
    }
  }

  // Remove a song from a group
  static async removeSong(groupId: string, songId: string): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      
      await collection.updateOne(
        { _id: new ObjectId(groupId) },
        { 
          $pull: { 
            songs: songId,
            songTranspositions: { songId: songId }
          },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(groupId);
    } catch (error) {
      console.error("Error removing song from group:", error);
      throw error;
    }
  }

  // Add a member to a group
  static async addMember(groupId: string, userId: string): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      
      await collection.updateOne(
        { _id: new ObjectId(groupId) },
        { 
          $addToSet: { members: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(groupId);
    } catch (error) {
      console.error("Error adding member to group:", error);
      throw error;
    }
  }

  // Remove a member from a group
  static async removeMember(groupId: string, userId: string): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      
      await collection.updateOne(
        { _id: new ObjectId(groupId) },
        { 
          $pull: { members: userId },
          $set: { updatedAt: new Date() }
        }
      );
      
      return await this.findById(groupId);
    } catch (error) {
      console.error("Error removing member from group:", error);
      throw error;
    }
  }

  // Update song transposition in a group
  static async updateSongTransposition(
    groupId: string, 
    songId: string, 
    transposition: number,
    useFlats: boolean = false
  ): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      
      // First check if the transposition entry exists
      const group = await this.findById(groupId);
      if (!group) return null;
      
      const existingTransposition = group.songTranspositions?.find(t => t.songId === songId);
      
      if (existingTransposition) {
        // Update existing transposition
        await collection.updateOne(
          { 
            _id: new ObjectId(groupId),
            "songTranspositions.songId": songId 
          },
          { 
            $set: { 
              "songTranspositions.$.transposition": transposition,
              "songTranspositions.$.useFlats": useFlats,
              updatedAt: new Date()
            } 
          }
        );
      } else {
        // Add new transposition
        await collection.updateOne(
          { _id: new ObjectId(groupId) },
          { 
            $push: { 
              songTranspositions: { songId, transposition, useFlats }
            },
            $set: { updatedAt: new Date() }
          }
        );
      }
      
      return await this.findById(groupId);
    } catch (error) {
      console.error("Error updating song transposition:", error);
      throw error;
    }
  }

  // List groups with various filters
  static async list(
    filters: { 
      organizationId?: string, 
      memberId?: string,
      createdBy?: string
    } = {},
    page = 1, 
    limit = 20
  ): Promise<Group[]> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      const skip = (page - 1) * limit;
      
      // Build query from filters
      const query: any = {};
      if (filters.organizationId) query.organizationId = filters.organizationId;
      if (filters.memberId) query.members = filters.memberId;
      if (filters.createdBy) query.createdBy = filters.createdBy;
      
      const results = await collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      return results.map(doc => this.toGroup(doc as MongoGroup));
    } catch (error) {
      console.error("Error listing groups:", error);
      throw error;
    }
  }

  // List groups accessible by a user (direct member OR via organization membership)
  static async listForUser(userId: string, orgIds: string[], page = 1, limit = 100): Promise<Group[]> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      const skip = (page - 1) * limit;

      const query: any = {
        $or: [
          { members: userId },           // direct group member
          { organizationId: { $in: orgIds } }  // member of the org that owns the group
        ]
      };

      const results = await collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      return results.map(doc => this.toGroup(doc as MongoGroup));
    } catch (error) {
      console.error("Error listing groups for user:", error);
      throw error;
    }
  }

  // Update musician assignments for a group
  static async updateMusicianAssignments(
    groupId: string,
    assignments: MusicianAssignment[]
  ): Promise<Group | null> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);

      await collection.updateOne(
        { _id: new ObjectId(groupId) },
        {
          $set: {
            musicianAssignments: assignments,
            updatedAt: new Date()
          }
        }
      );

      return await this.findById(groupId);
    } catch (error) {
      console.error("Error updating musician assignments:", error);
      throw error;
    }
  }

  // Aggregate personal stats for a user across all groups
  static async getUserStats(userId: string): Promise<{
    organizations: Array<{
      organizationId: string;
      totalSets: number;
      instruments: Record<string, number>;
      sets: Array<{ groupId: string; groupName: string; instrument: string; date: string }>;
    }>;
  }> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);

      // Find all groups where this user has a musician assignment
      const groups = await collection
        .find({ "musicianAssignments.userId": userId })
        .toArray();

      const statsMap = new Map<string, {
        totalSets: number;
        instruments: Record<string, number>;
        sets: Array<{ groupId: string; groupName: string; instrument: string; date: string }>;
      }>();

      for (const group of groups) {
        const assignments: MusicianAssignment[] = (group as any).musicianAssignments || [];
        const userAssignment = assignments.find(a => a.userId === userId);
        
        if (userAssignment) {
          const orgId = group.organizationId;
          
          if (!statsMap.has(orgId)) {
            statsMap.set(orgId, { totalSets: 0, instruments: {}, sets: [] });
          }
          
          const entry = statsMap.get(orgId)!;
          entry.totalSets += 1;
          entry.instruments[userAssignment.instrument] = (entry.instruments[userAssignment.instrument] || 0) + 1;
          entry.sets.push({
            groupId: group._id.toString(),
            groupName: group.name,
            instrument: userAssignment.instrument,
            date: group.createdAt.toISOString()
          });
        }
      }

      const organizations = Array.from(statsMap.entries()).map(([organizationId, data]) => ({
        organizationId,
        ...data
      }));

      return { organizations };
    } catch (error) {
      console.error("Error getting user stats:", error);
      throw error;
    }
  }

  // Aggregate musician stats across all groups in an organization
  static async getMusicianStats(organizationId: string): Promise<{
    members: Array<{
      userId: string;
      totalSets: number;
      instruments: Record<string, number>;
      sets: Array<{ groupId: string; groupName: string; instrument: string; date: string }>;
    }>;
  }> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      const orgDoc = await orgCollection.findOne({ _id: new ObjectId(organizationId) });
      const query: any = { organizationId };
      
      if (orgDoc && orgDoc.statsDataRetentionMonths) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - orgDoc.statsDataRetentionMonths);
        query.createdAt = { $gte: cutoffDate };
      }

      const groups = await collection
        .find(query)
        .toArray();

      // Aggregate per-user stats
      const statsMap = new Map<string, {
        totalSets: number;
        instruments: Record<string, number>;
        sets: Array<{ groupId: string; groupName: string; instrument: string; date: string }>;
      }>();

      for (const group of groups) {
        const assignments: MusicianAssignment[] = (group as any).musicianAssignments || [];
        for (const a of assignments) {
          if (!statsMap.has(a.userId)) {
            statsMap.set(a.userId, { totalSets: 0, instruments: {}, sets: [] });
          }
          const entry = statsMap.get(a.userId)!;
          entry.totalSets += 1;
          entry.instruments[a.instrument] = (entry.instruments[a.instrument] || 0) + 1;
          entry.sets.push({
            groupId: group._id.toString(),
            groupName: group.name,
            instrument: a.instrument,
            date: group.createdAt.toISOString()
          });
        }
      }

      const members = Array.from(statsMap.entries()).map(([userId, data]) => ({
        userId,
        ...data
      }));

      return { members };
    } catch (error) {
      console.error("Error getting musician stats:", error);
      throw error;
    }
  }

  // Check if an instrument is currently assigned in any group within the organization
  static async isInstrumentInUse(organizationId: string, instrument: string): Promise<boolean> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      const inUseCount = await collection.countDocuments({
        organizationId,
        "musicianAssignments.instrument": instrument
      });
      return inUseCount > 0;
    } catch (error) {
      console.error("Error checking if instrument is in use:", error);
      throw error;
    }
  }

  // Aggregate song stats across all groups in an organization
  static async getSongStats(organizationId: string): Promise<{
    songs: Array<{
      songId: string;
      totalSets: number;
      sets: Array<{ groupId: string; groupName: string; date: string }>;
    }>;
  }> {
    try {
      const collection = await getCollection(COLLECTIONS.GROUPS);
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      
      const orgDoc = await orgCollection.findOne({ _id: new ObjectId(organizationId) });
      const query: any = { organizationId };
      
      if (orgDoc && orgDoc.statsDataRetentionMonths) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - orgDoc.statsDataRetentionMonths);
        query.createdAt = { $gte: cutoffDate };
      }

      const groups = await collection
        .find(query)
        .toArray();

      const statsMap = new Map<string, {
        totalSets: number;
        sets: Array<{ groupId: string; groupName: string; date: string }>;
      }>();

      for (const group of groups) {
        const songs: string[] = (group as any).songs || [];
        for (const songId of songs) {
          if (!statsMap.has(songId)) {
            statsMap.set(songId, { totalSets: 0, sets: [] });
          }
          const entry = statsMap.get(songId)!;
          entry.totalSets += 1;
          entry.sets.push({
            groupId: group._id.toString(),
            groupName: group.name,
            date: group.createdAt.toISOString()
          });
        }
      }

      const songStats = Array.from(statsMap.entries()).map(([songId, data]) => ({
        songId,
        ...data
      }));

      return { songs: songStats };
    } catch (error) {
      console.error("Error getting song stats:", error);
      throw error;
    }
  }
}
