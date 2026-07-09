
import { GroupModel } from '../models/group';
import { MessageModel } from '../models/message';
import { GroupInput, GroupUpdateInput, MessageInput } from '@/lib/types';

export async function getGroups(filters = {}, page = 1, limit = 20) {
  try {
    return await GroupModel.list(filters, page, limit);
  } catch (error) {
    console.error("Get groups error:", error);
    throw error;
  }
}

export async function getGroup(id: string) {
  try {
    const group = await GroupModel.findById(id);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  } catch (error) {
    console.error("Get group error:", error);
    throw error;
  }
}

export async function createGroup(groupData: GroupInput, createdBy: string) {
  try {
    return await GroupModel.create(groupData, createdBy);
  } catch (error) {
    console.error("Create group error:", error);
    throw error;
  }
}

export async function updateGroup(id: string, updates: GroupUpdateInput) {
  try {
    const group = await GroupModel.update(id, updates);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  } catch (error) {
    console.error("Update group error:", error);
    throw error;
  }
}

export async function deleteGroup(id: string) {
  try {
    const success = await GroupModel.delete(id);
    if (!success) {
      throw new Error('Failed to delete group');
    }
    return { success };
  } catch (error) {
    console.error("Delete group error:", error);
    throw error;
  }
}

export async function addSongToGroup(groupId: string, songId: string) {
  try {
    const group = await GroupModel.addSong(groupId, songId);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  } catch (error) {
    console.error("Add song to group error:", error);
    throw error;
  }
}

export async function removeSongFromGroup(groupId: string, songId: string) {
  try {
    const group = await GroupModel.removeSong(groupId, songId);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  } catch (error) {
    console.error("Remove song from group error:", error);
    throw error;
  }
}

export async function addMemberToGroup(groupId: string, userId: string) {
  try {
    const group = await GroupModel.addMember(groupId, userId);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  } catch (error) {
    console.error("Add member to group error:", error);
    throw error;
  }
}

export async function removeMemberFromGroup(groupId: string, userId: string) {
  try {
    const group = await GroupModel.removeMember(groupId, userId);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  } catch (error) {
    console.error("Remove member from group error:", error);
    throw error;
  }
}

export async function updateSongTransposition(
  groupId: string, 
  songId: string, 
  transposition: number,
  useFlats: boolean = false
) {
  try {
    const group = await GroupModel.updateSongTransposition(groupId, songId, transposition, useFlats);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  } catch (error) {
    console.error("Update song transposition error:", error);
    throw error;
  }
}

export async function sendGroupMessage(message: MessageInput, userId: string) {
  try {
    return await MessageModel.create(message, userId);
  } catch (error) {
    console.error("Send group message error:", error);
    throw error;
  }
}

export async function getGroupMessages(groupId: string) {
  try {
    return await MessageModel.getGroupMessages(groupId);
  } catch (error) {
    console.error("Get group messages error:", error);
    throw error;
  }
}
