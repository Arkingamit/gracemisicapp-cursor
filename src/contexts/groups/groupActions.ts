import { Group, GroupInput, GroupUpdateInput, Message, MessageInput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/types';
import { authFetch } from '@/contexts/AuthContext';

// Actions for group operations
export const createGroupActions = (
  groups: Group[],
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>,
  currentUser: User | null,
  toast: ReturnType<typeof useToast>["toast"],
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const createGroup = async (groupInput: GroupInput): Promise<string> => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in to create a group');

      const res = await authFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify(groupInput),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      setGroups(prev => [...prev, data.group]);
      toast({ title: "Group created", description: `${data.group.name} has been created successfully` });
      return data.group.id;
    } catch (error) {
      toast({ title: "Failed to create group", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getGroup = (id: string) => groups.find(group => group.id === id);

  const updateGroup = async (id: string, updatedGroupData: GroupUpdateInput) => {
    const existingGroup = groups.find(g => g.id === id);
    if (existingGroup) {
      const keys = Object.keys(updatedGroupData) as Array<keyof GroupUpdateInput>;
      const hasChanges = keys.some(key => {
        if (key === 'songTranspositions' || key === 'members' || key === 'songs' || key === 'songEditStates') {
          return JSON.stringify(updatedGroupData[key]) !== JSON.stringify(existingGroup[key]);
        }
        return updatedGroupData[key] !== existingGroup[key];
      });

      if (!hasChanges) {
        return;
      }
    }

    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in to update a group');

      const res = await authFetch(`/api/groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedGroupData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update group');

      setGroups(prev => prev.map(g => g.id === id ? data.group : g));
      toast({ title: "Group updated", description: `${data.group.name} has been updated successfully` });
    } catch (error) {
      toast({ title: "Failed to update group", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!currentUser) throw new Error('You must be logged in to delete a group');

    const previous = groups;
    const group = groups.find((g) => g.id === id);
    if (!group) throw new Error('Group not found');

    // Optimistic remove from the list
    setGroups((prev) => prev.filter((g) => g.id !== id));

    try {
      const res = await authFetch(`/api/groups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete group');
      }
      toast({ title: "Group deleted", description: `${group.name} has been deleted successfully` });
    } catch (error) {
      setGroups(previous);
      toast({
        title: "Couldn't delete song set",
        description:
          (error instanceof Error ? error.message : "An unknown error occurred") +
          ` — "${group.name}" has been restored.`,
        variant: "destructive",
      });
      throw error;
    }
  };

  return { createGroup, getGroup, updateGroup, deleteGroup };
};

export const createSongActions = (
  groups: Group[],
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>,
  currentUser: User | null,
  toast: ReturnType<typeof useToast>["toast"],
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const addSongToGroup = async (groupId: string, songId: string) => {
    if (!currentUser) throw new Error('You must be logged in');

    const previous = groups.find((g) => g.id === groupId);
    if (!previous) throw new Error('Group not found');
    if (previous.songs.includes(songId)) {
      toast({ title: "Already added", description: "That song is already in this song set." });
      return;
    }

    // Optimistic add — list updates immediately
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, songs: [...g.songs, songId], updatedAt: new Date().toISOString() }
          : g
      )
    );

    try {
      const res = await authFetch(`/api/groups/${groupId}/songs`, {
        method: 'POST',
        body: JSON.stringify({ songId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add song');

      // Reconcile with server truth when available
      if (data.group) {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? data.group : g)));
      }
      // Success feedback is left to the caller (avoids N toasts when adding many songs)
    } catch (error) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? previous : g)));
      toast({
        title: "Couldn't add song",
        description:
          (error instanceof Error ? error.message : "An unknown error occurred") +
          " — the song set has been restored.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const removeSongFromGroup = async (groupId: string, songId: string) => {
    if (!currentUser) throw new Error('You must be logged in');

    const previous = groups.find((g) => g.id === groupId);
    if (!previous) throw new Error('Group not found');

    // Optimistic remove — song disappears from the list immediately
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              songs: g.songs.filter((id) => id !== songId),
              songTranspositions: (g.songTranspositions || []).filter(
                (t) => t.songId !== songId
              ),
              updatedAt: new Date().toISOString(),
            }
          : g
      )
    );

    try {
      const res = await authFetch(`/api/groups/${groupId}/songs`, {
        method: 'DELETE',
        body: JSON.stringify({ songId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove song');

      if (data.group) {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? data.group : g)));
      }
      toast({ title: "Song removed from group", description: `Song has been removed successfully` });
    } catch (error) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? previous : g)));
      toast({
        title: "Couldn't remove song",
        description:
          (error instanceof Error ? error.message : "An unknown error occurred") +
          " — the song has been put back.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return { addSongToGroup, removeSongFromGroup };
};

export const createMemberActions = (
  groups: Group[],
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>,
  currentUser: User | null,
  toast: ReturnType<typeof useToast>["toast"],
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const addMemberToGroup = async (groupId: string, userId: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in');

      const group = groups.find(g => g.id === groupId);
      if (!group) throw new Error('Group not found');

      const res = await authFetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify({ members: [...group.members, userId] }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');

      setGroups(prev => prev.map(g => g.id === groupId ? data.group : g));
      toast({ title: "Member added to group", description: `User has been added successfully` });
    } catch (error) {
      toast({ title: "Failed to add member", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeMemberFromGroup = async (groupId: string, userId: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in');

      const group = groups.find(g => g.id === groupId);
      if (!group) throw new Error('Group not found');

      const res = await authFetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify({ members: group.members.filter(m => m !== userId) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');

      setGroups(prev => prev.map(g => g.id === groupId ? data.group : g));
      toast({ title: "Member removed from group", description: `User has been removed successfully` });
    } catch (error) {
      toast({ title: "Failed to remove member", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { addMemberToGroup, removeMemberFromGroup };
};

export const createMessageActions = (
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  groups: Group[],
  currentUser: User | null,
  toast: ReturnType<typeof useToast>["toast"]
) => {
  const sendMessage = async (messageInput: MessageInput) => {
    try {
      if (!currentUser) throw new Error('You must be logged in');

      const res = await authFetch(`/api/groups/${messageInput.groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: messageInput.content }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      setMessages(prev => [...prev, data.message]);
    } catch (error) {
      toast({ title: "Failed to send message", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    }
  };

  const getGroupMessages = (groupId: string) => {
    return messages.filter(message => message.groupId === groupId);
  };

  return { sendMessage, getGroupMessages };
};

export const createQueryActions = (groups: Group[]) => {
  const getOrganizationGroups = (organizationId: string) => {
    return groups.filter(group => group.organizationId === organizationId);
  };

  return { getOrganizationGroups };
};
