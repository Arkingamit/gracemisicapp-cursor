import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import AddToGroupButton from '@/components/AddToGroupButton';
import LikeButton from '@/components/LikeButton';
import AddToPlaylistDialog from '@/components/AddToPlaylistDialog';
import { Pencil, Trash2, Globe, Lock, X, ArrowLeft, Heart, ListMusic, Copy, ChevronLeft, Plus, Music } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { detectKey } from '@/lib/keyDetection';
import { getKeyDisplayName } from '@/lib/chordUtils';
import CopyToOrgButton from '@/components/CopyToOrgButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MUSICAL_KEYS = [
  // Major keys
  'C', 
  'C# / Db', 
  'D', 
  'D# / Eb', 
  'E', 
  'F', 
  'F# / Gb', 
  'G', 
  'G# / Ab', 
  'A', 
  'A# / Bb', 
  'B',
  // Minor keys
  'Cm',
  'C#m / Dbm',
  'Dm',
  'D#m / Ebm',
  'Em',
  'Fm',
  'F#m / Gbm',
  'Gm',
  'G#m / Abm',
  'Am',
  'A#m / Bbm',
  'Bm'
];

type FilterTab = 'all' | 'global' | 'org';

const SongList = () => {
  const { songs, loading, deleteSong, makeSongGlobal, copySongToGlobal } = useSongs();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showActionBar, setShowActionBar] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read genre or search from URL on mount / param change
  useEffect(() => {
    const genre = searchParams.get('genre');
    const language = searchParams.get('language');
    const search = searchParams.get('search');
    if (genre) {
      setGenreFilter(genre);
      setLanguageFilter(null);
      setSearchQuery('');
    } else if (language) {
      setLanguageFilter(language);
      setGenreFilter(null);
      setSearchQuery('');
    } else if (search) {
      setSearchQuery(search);
      setGenreFilter(null);
      setLanguageFilter(null);
    }
  }, [searchParams]);

  const clearGenreFilter = () => {
    setGenreFilter(null);
    setLanguageFilter(null);
    router.replace('/songs');
  };

  const handleLanguageChange = (val: string) => {
    if (val === 'all') {
      setLanguageFilter(null);
      router.replace('/songs');
    } else {
      setLanguageFilter(val);
      router.replace(`/songs?language=${encodeURIComponent(val)}`);
    }
  };

  // Scroll detection for hiding/showing the actions bar
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 20) {
        setShowActionBar(false);
      } else if (currentScrollY < lastScrollY) {
        setShowActionBar(true);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Pre-calculate keys to make searching fast and avoid re-calculating on every render
  const songKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    songs.forEach(song => {
      keys[song.id] = song.originalKey || detectKey(song.lyrics);
    });
    return keys;
  }, [songs]);

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    songs.forEach(song => {
      if (song.language) langs.add(song.language);
    });
    return Array.from(langs).sort();
  }, [songs]);

  // Filter songs based on genre filter, search query, key filter + tab filter
  const filteredSongs = songs.filter(song => {
    // Genre filter takes priority when set
    if (genreFilter) {
      if (!song.genre.some(g => g.toLowerCase() === genreFilter.toLowerCase())) return false;
    } else if (languageFilter) {
      if (song.language?.toLowerCase() !== languageFilter.toLowerCase()) return false;
    } else {
      const q = searchQuery.toLowerCase().trim();
      const songKey = songKeys[song.id] || '';
      
      // key dropdown filter (handle grouped keys e.g., 'C# / Db')
      if (keyFilter !== 'all') {
        const allowedKeys = keyFilter.split(/ \/ /);
        if (!allowedKeys.includes(songKey)) {
          return false;
        }
      }
      
      let matchesSearch = false;
      if (q.startsWith('key:')) {
        // Explicit key search (e.g. "key:G")
        const keyQuery = q.substring(4).trim();
        matchesSearch = songKey.toLowerCase() === keyQuery;
      } else {
        // General search
        matchesSearch =
          songKey.toLowerCase() === q || // exact key match
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q) ||
          song.genre.some(g => g.toLowerCase().includes(q));
      }
      if (!matchesSearch) return false;
    }

    if (activeFilter === 'global') return !song.organizationId;
    if (activeFilter === 'org') return !!song.organizationId;
    return true; // 'all'
  });

  const handleDeleteSong = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this song?')) {
      try {
        await deleteSong(id);
      } catch (error) {
        console.error('Failed to delete song:', error);
      }
    }
  };

  const canEdit = (songCreatedBy: string) => {
    if (!currentUser) return false;
    return currentUser.role === 'super_admin' || 
          currentUser.role === 'editor' ||
          (currentUser.role === 'manager' && songCreatedBy === currentUser.id);
  };

  const hasActions = !!currentUser;

  const filterTabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All Songs', icon: null },
    { key: 'global', label: 'Global', icon: <Globe className="h-3.5 w-3.5" /> },
    { key: 'org', label: 'My Org', icon: <Lock className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-zinc-950 pt-8 pb-6">
        <div className="container mx-auto px-4">
          {(genreFilter || languageFilter) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-0 h-auto text-zinc-400 hover:text-white hover:bg-transparent flex items-center gap-1 text-sm font-medium mb-6"
              onClick={clearGenreFilter}
            >
              <ChevronLeft className="w-4 h-4" />
              All Songs
            </Button>
          )}

          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="bg-primary/20 text-primary border-none uppercase tracking-widest text-[10px] font-black px-3 py-1 rounded-full w-fit">
                LIBRARY
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md">
                {genreFilter ? genreFilter : languageFilter ? languageFilter : 'Songs'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-zinc-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div 
        className={`sticky top-0 z-20 bg-transparent/80 backdrop-blur-md border-b border-white/5 py-4 transition-transform duration-150 ${
          showActionBar ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Filter Tabs */}
          <div className="flex p-0.5 border border-zinc-800 rounded-lg bg-zinc-900/60 w-full sm:w-auto">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap border-none ${
                  activeFilter === tab.key
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search songs..."
              className="w-full sm:w-[200px] border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
              <Select value={languageFilter || 'all'} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-[120px] shrink-0 border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 font-medium hover:bg-zinc-800 transition-colors">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-100">
                  <SelectItem value="all">All Langs</SelectItem>
                  {availableLanguages.map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={keyFilter} onValueChange={setKeyFilter}>
                <SelectTrigger className="w-[110px] shrink-0 border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 font-medium hover:bg-zinc-800 transition-colors">
                  <SelectValue placeholder="Key" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-100">
                  <SelectItem value="all">All Keys</SelectItem>
                  {MUSICAL_KEYS.map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentUser && currentUser.role !== 'user' && (
                <Button 
                  onClick={() => router.push('/songs/new')} 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium h-9 px-4 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Song</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-0 sm:px-4 py-8">
          {loading ? (
            <div className="text-center py-4">Loading songs...</div>
          ) : filteredSongs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {searchQuery
                ? 'No songs match your search criteria'
                : activeFilter === 'org'
                  ? 'No organization songs yet. Create one with the "Add Song" button!'
                  : 'No songs available. Add some songs to get started!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Genre</TableHead>
                    {hasActions && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSongs.map((song) => (
                    <TableRow
                      key={song.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/songs/view?id=${song.id}`)}
                    >
                      <TableCell className="font-medium">{song.title}</TableCell>
                      <TableCell>{song.artist}</TableCell>
                      <TableCell className="text-muted-foreground">{getKeyDisplayName(songKeys[song.id]) || '-'}</TableCell>
                      <TableCell>{song.language || 'English'}</TableCell>
                      <TableCell>{song.genre.join(', ')}</TableCell>
                      {hasActions && (
                        <TableCell className="text-right">
                          <div
                            className="flex flex-nowrap items-center justify-end gap-1 overflow-x-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {currentUser && (
                              <>
                                <LikeButton songId={song.id} size="icon" className="h-8 w-8 shrink-0" />
                                <AddToPlaylistDialog 
                                  songId={song.id} 
                                  trigger={
                                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                                      <ListMusic className="h-4 w-4" />
                                    </Button>
                                  }
                                />
                                <AddToGroupButton 
                                  songId={song.id} 
                                  songTitle={song.title} 
                                />
                                <CopyToOrgButton
                                  songId={song.id}
                                  songTitle={song.title}
                                  songOrgId={song.organizationId}
                                  variant="icon"
                                />
                              </>
                            )}
                            {canEdit(song.createdBy) && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Edit"
                                  onClick={() => router.push(`/songs/edit?id=${song.id}`)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Delete"
                                  onClick={() => handleDeleteSong(song.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {currentUser && currentUser.role === 'super_admin' && song.organizationId && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                                  title="Transfer to Global (Moves the song)"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to MOVE "${song.title}" to the global library? It will no longer belong to this organization.`)) {
                                      makeSongGlobal(song.id);
                                    }
                                  }}
                                >
                                  <Globe className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                                  title="Copy to Global (Duplicates the song)"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to COPY "${song.title}" to the global library? A duplicate will be created in the public library.`)) {
                                      copySongToGlobal(song.id);
                                    }
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
      </div>
    </div>
  );
};

export default SongList;

