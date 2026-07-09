
import { SongModel } from '../models/song';
import { SongInput, SongUpdateInput } from '@/lib/types';

export async function getSongs(page = 1, limit = 20, filters = {}) {
  try {
    return await SongModel.list(page, limit, filters);
  } catch (error) {
    console.error("Get songs error:", error);
    throw error;
  }
}

export async function getSong(id: string) {
  try {
    const song = await SongModel.findById(id);
    if (!song) {
      throw new Error('Song not found');
    }
    return song;
  } catch (error) {
    console.error("Get song error:", error);
    throw error;
  }
}

export async function createSong(songData: SongInput) {
  try {
    return await SongModel.create(songData);
  } catch (error) {
    console.error("Create song error:", error);
    throw error;
  }
}

export async function updateSong(id: string, updates: SongUpdateInput) {
  try {
    const song = await SongModel.update(id, updates);
    if (!song) {
      throw new Error('Song not found');
    }
    return song;
  } catch (error) {
    console.error("Update song error:", error);
    throw error;
  }
}

export async function deleteSong(id: string) {
  try {
    const success = await SongModel.delete(id);
    if (!success) {
      throw new Error('Failed to delete song');
    }
    return { success };
  } catch (error) {
    console.error("Delete song error:", error);
    throw error;
  }
}

export async function getSongStats() {
  try {
    return await SongModel.getStats();
  } catch (error) {
    console.error("Get song stats error:", error);
    throw error;
  }
}
