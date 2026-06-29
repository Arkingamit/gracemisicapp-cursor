import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback
} from 'react';
import { Song, SongInput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth, authFetch } from './AuthContext';
import { getFullUrl } from '@/lib/api';


interface SongContextType {
  songs: Song[];
  loading: boolean;
  addSong: (song: SongInput) => Promise<void>;
  getSong: (id: string) => Song | undefined;
  updateSong: (id: string, song: Partial<Song>) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  getAllSongs: () => Song[];
  refreshSongs: () => Promise<void>;
  fetchSongDetails: (id: string) => Promise<Song>;
  makeSongGlobal: (id: string) => Promise<void>;
  copySongToGlobal: (id: string) => Promise<void>;
  copySongToOrg: (id: string, organizationId: string) => Promise<void>;
  deleteMultipleSongs: (ids: string[]) => Promise<void>;
}

const SongContext = createContext<SongContextType | null>(null);

export const SongProvider = ({ children }: { children: ReactNode }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();

  // Fetch songs from API
  const refreshSongs = useCallback(async () => {
    const fetchUrl = getFullUrl('/api/songs?globalLimit=0&orgLimit=1000');
    try {
      setLoading(true);
      const res = await authFetch('/api/songs?globalLimit=0&orgLimit=1000');
      if (res.ok) {
        const data = await res.json();
        setSongs(data.songs);
      } else {
        const errorText = await res.text();
        console.error(`Failed to load songs from ${fetchUrl}:`, res.status, errorText);
        // During mobile debugging, it's helpful to see the error
        if (process.env.NEXT_PUBLIC_BASE_URL) {
          toast({
            title: 'API Error',
            description: `Status ${res.status} from ${fetchUrl}. Is the backend deployed?`,
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error(`Fetch exception for ${fetchUrl}:`, error);
      toast({
        title: 'Fetch Failure',
        description: `Could not reach ${fetchUrl}. Check internet and CORS.`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch songs when auth state finishes loading or user changes
  useEffect(() => {
    if (!authLoading) {
      refreshSongs();
    }
  }, [authLoading, currentUser, refreshSongs]);




  // Fetch full details (including lyrics) for a single song
  const fetchSongDetails = async (id: string): Promise<Song> => {
    // Check if we already have the full song (with lyrics)
    const existing = songs.find(s => s.id === id);
    if (existing && existing.lyrics) {
      return existing;
    }

    try {
      const fetchUrl = getFullUrl(`/api/songs/${id}`);
      const res = await authFetch(`/api/songs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch song details');
      
      const data = await res.json();
      const fullSong: Song = data.song;

      setSongs(prev => {
        const idx = prev.findIndex(s => s.id === id);
        if (idx !== -1) {
          const newSongs = [...prev];
          newSongs[idx] = fullSong;
          return newSongs;
        }
        return [...prev, fullSong];
      });

      return fullSong;
    } catch (error) {
      console.error(`Error fetching details for song ${id}:`, error);
      throw error;
    }
  };

  const addSong = async (songInput: SongInput) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in to add a song');
      // Removed invalid 'viewer' check as 'viewer' is not a defined role
        const res = await authFetch('/api/songs', {
        method: 'POST',
        body: JSON.stringify(songInput),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add song');

      setSongs(prev => [...prev, data.song]);

      toast({
        title: 'Song added',
        description: `${data.song.title} has been added successfully`
      });
    } catch (error) {
      toast({
        title: 'Failed to add song',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getSong = (id: string) => songs.find(song => song.id === id);

  const updateSong = async (id: string, updatedSongData: Partial<Song>) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in to update a song');

      const res = await authFetch(`/api/songs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedSongData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update song');

      setSongs(prev => prev.map(s => s.id === id ? data.song : s));

      toast({
        title: 'Song updated',
        description: `${data.song.title} has been updated successfully`
      });
    } catch (error) {
      toast({
        title: 'Failed to update song',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteSong = async (id: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in to delete a song');

      const song = songs.find(s => s.id === id);
      if (!song) throw new Error('Song not found');

      const res = await authFetch(`/api/songs/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete song');
      }

      setSongs(prev => prev.filter(s => s.id !== id));

      toast({
        title: 'Song deleted',
        description: `${song.title} has been deleted successfully`
      });
    } catch (error) {
      toast({
        title: 'Failed to delete song',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteMultipleSongs = async (ids: string[]) => {
    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    try {
      if (!currentUser) throw new Error('You must be logged in to delete songs');

      for (const id of ids) {
        const res = await authFetch(`/api/songs/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          successCount++;
          setSongs(prev => prev.filter(s => s.id !== id));
        } else {
          failCount++;
        }
      }

      toast({
        title: 'Bulk Deletion Complete',
        description: `Successfully deleted ${successCount} songs.` + (failCount > 0 ? ` Failed to delete ${failCount}.` : '')
      });
    } catch (error) {
      toast({
        title: 'Bulk Delete Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const makeSongGlobal = async (id: string) => {
    setLoading(true);
    try {
      if (!currentUser || currentUser.role !== 'super_admin') {
        throw new Error('Only super admins can make songs global');
      }

      const res = await authFetch(`/api/songs/${id}/make-global`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to transfer song');

      // Update the song locally by stripping org ID implicitly replaced by 'data.song'
      setSongs(prev => prev.map(s => s.id === id ? data.song : s));

      toast({
        title: 'Song Transfer Complete',
        description: `${data.song.title} is now available in the global library.`
      });
    } catch (error) {
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const copySongToGlobal = async (id: string) => {
    setLoading(true);
    try {
      if (!currentUser || currentUser.role !== 'super_admin') {
        throw new Error('Only super admins can copy songs to global');
      }

      const res = await authFetch(`/api/songs/${id}/copy-to-global`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to copy song');

      // Add the new song to the local list
      setSongs(prev => [...prev, data.song]);

      toast({
        title: 'Song Copied to Global',
        description: `${data.song.title} has been copied to the global library.`
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const copySongToOrg = async (id: string, organizationId: string) => {
    setLoading(true);
    try {
      if (!currentUser) {
        throw new Error('You must be logged in');
      }

      const res = await authFetch(`/api/songs/${id}/copy-to-org`, {
        method: 'POST',
        body: JSON.stringify({ organizationId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to copy song');

      // Add the new song to the local list
      setSongs(prev => [...prev, data.song]);

      toast({
        title: 'Song Added to Library',
        description: `${data.song.title} has been added to your organization's library.`
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getAllSongs = () => songs;

  const value: SongContextType = {
    songs,
    loading,
    addSong,
    getSong,
    updateSong,
    deleteSong,
    getAllSongs,
    refreshSongs,
    fetchSongDetails,
    makeSongGlobal,
    copySongToGlobal,
    copySongToOrg,
    deleteMultipleSongs
  };

  return <SongContext.Provider value={value}>{children}</SongContext.Provider>;
};

export const useSongs = () => {
  const context = useContext(SongContext);
  if (!context) {
    throw new Error('useSongs must be used within a SongProvider');
  }
  return context;
};
