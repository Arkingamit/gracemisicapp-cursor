import { ObjectId } from 'mongodb';
import { getCollection } from '../db/connection';
import { COLLECTIONS } from '../db/collections';
import { JoinRequest } from '@/lib/types';
import { UserModel } from './user';
import { OrganizationModel } from './organization';

export class JoinRequestModel {
  static async create(organizationId: string, userId: string): Promise<JoinRequest> {
    const collection = await getCollection(COLLECTIONS.JOIN_REQUESTS);
    
    // Check if already requested
    const existing = await collection.findOne({ organizationId, userId, status: 'pending' });
    if (existing) {
      throw new Error('You have already requested to join this organization.');
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    
    const org = await OrganizationModel.findById(organizationId);
    if (!org) throw new Error('Organization not found');
    
    if (org.members.includes(userId)) {
      throw new Error('You are already a member of this organization.');
    }

    const now = new Date();
    const request = {
      organizationId,
      userId,
      userEmail: user.email,
      userName: user.name || user.username || 'Unknown',
      status: 'pending',
      createdAt: now
    };

    const result = await collection.insertOne(request);
    return {
      id: result.insertedId.toString(),
      ...request,
      createdAt: now.toISOString()
    } as JoinRequest;
  }

  static async getPendingByOrganization(organizationId: string): Promise<JoinRequest[]> {
    const collection = await getCollection(COLLECTIONS.JOIN_REQUESTS);
    const requests = await collection.find({ organizationId, status: 'pending' }).toArray();
    
    return requests.map(doc => ({
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      userId: doc.userId,
      userEmail: doc.userEmail,
      userName: doc.userName,
      status: doc.status,
      createdAt: doc.createdAt.toISOString()
    }));
  }

  static async updateStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    const collection = await getCollection(COLLECTIONS.JOIN_REQUESTS);
    await collection.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status, updatedAt: new Date() } }
    );
  }

  static async findById(requestId: string): Promise<JoinRequest | null> {
    const collection = await getCollection(COLLECTIONS.JOIN_REQUESTS);
    const doc = await collection.findOne({ _id: new ObjectId(requestId) });
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      userId: doc.userId,
      userEmail: doc.userEmail,
      userName: doc.userName,
      status: doc.status,
      createdAt: doc.createdAt.toISOString()
    } as JoinRequest;
  }
}
