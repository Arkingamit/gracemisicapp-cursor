
import { UserModel } from '../models/user';
import { SongModel } from '../models/song';
import { AdminStats } from '@/lib/types';

export async function getAdminStats(): Promise<AdminStats> {
  try {
    // Get song stats
    const songStats = await SongModel.getStats();

    // Get total users count
    const users = await UserModel.list(1, 0); // Just to get count, not actual users
    const totalUsers = users.length;

    return {
      totalSongs: songStats.totalSongs,
      totalUsers,
      songsPerGenre: songStats.songsPerGenre,
      usersCount: totalUsers,
      songsCount: songStats.totalSongs,
      groupsCount: 0, // Default value
      organizationsCount: 0, // Default value
      recentlyAddedSongs: []
    };
  } catch (error) {
    console.error("Get admin stats error:", error);
    throw error;
  }
}

export async function getUsers(page = 1, limit = 20) {
  try {
    return await UserModel.list(page, limit);
  } catch (error) {
    console.error("Get users error:", error);
    throw error;
  }
}

export async function updateUserRole(userId: string, role: 'admin' | 'editor' | 'viewer') {
  try {
    const user = await UserModel.update(userId, { role });
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    console.error("Update user role error:", error);
    throw error;
  }
}

export async function deleteUser(userId: string) {
  try {
    const success = await UserModel.delete(userId);
    if (!success) {
      throw new Error('Failed to delete user');
    }
    return { success };
  } catch (error) {
    console.error("Delete user error:", error);
    throw error;
  }
}
