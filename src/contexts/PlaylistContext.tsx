
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Playlist, Song } from '@/lib/types';
import { useAuth, authFetch } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PlaylistContextType {
  playlists: Playlist[];
  favoriteIds: string[]; // Set of song IDs that are liked
  loading: boolean;
  createPlaylist: (name: string) => Promise<Playlist | null>;
  updatePlaylist: (id: string, name: string) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  toggleFavorite: (songId: string) => Promise<void>;
  isFavorite: (songId: string) => boolean;
  refreshPlaylists: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshPlaylists = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/playlists');
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists);
      }
    } catch (error) {
      console.error('Error refreshing playlists:', error);
    }
  }, [currentUser]);

  const refreshFavorites = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/favorites');
      if (res.ok) {
        const data = await res.json();
        setFavoriteIds(data.favorites || []);
      }
    } catch (error) {
      console.error('Error refreshing favorites:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      Promise.all([refreshPlaylists(), refreshFavorites()])
        .finally(() => setLoading(false));
    } else {
      setPlaylists([]);
      setFavoriteIds([]);
    }
  }, [currentUser, refreshPlaylists, refreshFavorites]);

  const createPlaylist = async (name: string) => {
    try {
      const res = await authFetch('/api/playlists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists(prev => [data.playlist, ...prev]);
        toast({ title: 'Success', description: `Playlist "${name}" created` });
        return data.playlist;
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to create playlist', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create playlist', variant: 'destructive' });
    }
    return null;
  };

  const updatePlaylist = async (id: string, name: string) => {
    const previous = playlists.find((p) => p.id === id);
    if (!previous) return null;

    // Optimistic rename
    setPlaylists((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p))
    );

    try {
      const res = await authFetch(`/api/playlists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists((prev) => prev.map((p) => (p.id === id ? data.playlist : p)));
        toast({ title: 'Success', description: 'Playlist updated' });
        return data.playlist;
      }
      setPlaylists((prev) => prev.map((p) => (p.id === id ? previous : p)));
      const data = await res.json().catch(() => ({}));
      toast({
        title: 'Couldn’t rename playlist',
        description: data.error || 'Your previous name has been restored.',
        variant: 'destructive',
      });
    } catch {
      setPlaylists((prev) => prev.map((p) => (p.id === id ? previous : p)));
      toast({
        title: 'Couldn’t rename playlist',
        description: 'Your previous name has been restored.',
        variant: 'destructive',
      });
    }
    return null;
  };

  const deletePlaylist = async (id: string) => {
    const previous = playlists;
    const removed = playlists.find((p) => p.id === id);

    // Optimistic remove from list
    setPlaylists((prev) => prev.filter((p) => p.id !== id));

    try {
      const res = await authFetch(`/api/playlists/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Playlist deleted' });
        return;
      }
      setPlaylists(previous);
      const data = await res.json().catch(() => ({}));
      toast({
        title: 'Couldn’t delete playlist',
        description: data.error || `"${removed?.name || 'Playlist'}" has been restored.`,
        variant: 'destructive',
      });
    } catch {
      setPlaylists(previous);
      toast({
        title: 'Couldn’t delete playlist',
        description: `"${removed?.name || 'Playlist'}" has been restored.`,
        variant: 'destructive',
      });
    }
  };

  const addSongToPlaylist = async (playlistId: string, songId: string) => {
    const previous = playlists.find((p) => p.id === playlistId);
    if (!previous) return;
    if (previous.songs.includes(songId)) {
      toast({ title: 'Already added', description: 'That song is already in this playlist.' });
      return;
    }

    // Optimistic add
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? { ...p, songs: [...p.songs, songId], updatedAt: new Date().toISOString() }
          : p
      )
    );

    try {
      const res = await authFetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        body: JSON.stringify({ songId }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Song added to playlist' });
        return;
      }
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? previous : p)));
      const data = await res.json().catch(() => ({}));
      toast({
        title: 'Couldn’t add song',
        description: data.error || 'The playlist has been restored.',
        variant: 'destructive',
      });
    } catch {
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? previous : p)));
      toast({
        title: 'Couldn’t add song',
        description: 'The playlist has been restored.',
        variant: 'destructive',
      });
    }
  };

  const removeSongFromPlaylist = async (playlistId: string, songId: string) => {
    const previous = playlists.find((p) => p.id === playlistId);
    if (!previous) return;

    // Optimistic remove
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              songs: p.songs.filter((id) => id !== songId),
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );

    try {
      const res = await authFetch(`/api/playlists/${playlistId}/songs?songId=${songId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Song removed from playlist' });
        return;
      }
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? previous : p)));
      const data = await res.json().catch(() => ({}));
      toast({
        title: 'Couldn’t remove song',
        description: data.error || 'The song has been put back in the playlist.',
        variant: 'destructive',
      });
    } catch {
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? previous : p)));
      toast({
        title: 'Couldn’t remove song',
        description: 'The song has been put back in the playlist.',
        variant: 'destructive',
      });
    }
  };

  const toggleFavorite = async (songId: string) => {
    const wasLiked = favoriteIds.includes(songId);

    // Optimistic toggle — UI updates before the network round trip
    setFavoriteIds((prev) =>
      wasLiked ? prev.filter((id) => id !== songId) : [...prev, songId]
    );

    try {
      const res = await authFetch('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ songId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reconcile with authoritative server result
        setFavoriteIds((prev) => {
          const currentlyLiked = prev.includes(songId);
          if (data.liked && !currentlyLiked) return [...prev, songId];
          if (!data.liked && currentlyLiked) return prev.filter((id) => id !== songId);
          return prev;
        });
        return;
      }
      // Rollback
      setFavoriteIds((prev) =>
        wasLiked
          ? prev.includes(songId)
            ? prev
            : [...prev, songId]
          : prev.filter((id) => id !== songId)
      );
      const data = await res.json().catch(() => ({}));
      toast({
        title: wasLiked ? 'Couldn’t unlike song' : 'Couldn’t like song',
        description: data.error || 'Your previous like state has been restored.',
        variant: 'destructive',
      });
    } catch {
      setFavoriteIds((prev) =>
        wasLiked
          ? prev.includes(songId)
            ? prev
            : [...prev, songId]
          : prev.filter((id) => id !== songId)
      );
      toast({
        title: wasLiked ? 'Couldn’t unlike song' : 'Couldn’t like song',
        description: 'Your previous like state has been restored.',
        variant: 'destructive',
      });
    }
  };

  const isFavorite = (songId: string) => favoriteIds.includes(songId);

  return (
    <PlaylistContext.Provider value={{
      playlists,
      favoriteIds,
      loading,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      toggleFavorite,
      isFavorite,
      refreshPlaylists,
      refreshFavorites,
    }}>
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylists = () => {
  const context = useContext(PlaylistContext);
  if (context === undefined) {
    throw new Error('usePlaylists must be used within a PlaylistProvider');
  }
  return context;
};
