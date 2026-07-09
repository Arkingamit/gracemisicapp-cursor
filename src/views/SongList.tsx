import { useState, useEffect, useMemo, useRef } from 'react';
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
import AddToGroupButton from '@/components/groups/AddToGroupButton';
import LikeButton from '@/components/songs/LikeButton';
import AddToPlaylistDialog from '@/components/playlists/AddToPlaylistDialog';
import { Pencil, Trash2, Globe, Lock, X, ArrowLeft, Heart, ListMusic, Copy, ChevronLeft, Plus, Music, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { detectKey } from '@/lib/keyDetection';
import { getKeyDisplayName } from '@/lib/chordUtils';
import CopyToOrgButton from '@/components/organizations/CopyToOrgButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Long press state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const handleTouchStart = (id: string) => {
    isLongPressRef.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setExpandedRow(id);
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    setExpandedRow(null);
  };

  const handleRowClick = (songId: string) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    router.push(`/songs/view?id=${songId}`);
  };

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

  // Scroll detection for hiding/showing the filter bar
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only hide if we've scrolled down far enough that the bar is sticky
      if (currentScrollY > lastScrollY && currentScrollY > 250) {
        setIsScrolledDown(true);
      } else {
        setIsScrolledDown(false);
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
    // 1. Genre filter
    if (genreFilter && !song.genre.some(g => g.toLowerCase() === genreFilter.toLowerCase())) {
      return false;
    }

    // 2. Language filter
    if (languageFilter && song.language?.toLowerCase() !== languageFilter.toLowerCase()) {
      return false;
    }

    const songKey = songKeys[song.id] || '';
    
    // 3. Key filter
    if (keyFilter !== 'all') {
      const allowedKeys = keyFilter.split(/ \/ /);
      if (!allowedKeys.includes(songKey)) {
        return false;
      }
    }

    // 4. Search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
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

    // 5. Tab filter
    if (activeFilter === 'global') return !song.organizationId;
    if (activeFilter === 'org') return !!song.organizationId;
    
    return true; // matches all active filters
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
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-zinc-950 pt-20 md:pt-28 pb-6">
        <div className="container mx-auto px-4">
          {(genreFilter || languageFilter) && (
            <Button 
              variant="outline" 
              size="sm" 
              className="border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold mb-6 px-3 py-1 rounded-full transition-all hover:scale-105"
              onClick={clearGenreFilter}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
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
        className={`sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 py-4 transition-all duration-300 ease-in-out ${
          isScrolledDown 
            ? '-translate-y-full opacity-0 pointer-events-none' 
            : 'translate-y-0 opacity-100 pointer-events-auto'
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

          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
            {/* Search and Add Song Row */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="Search songs..."
                className="flex-1 sm:w-[200px] border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {currentUser && currentUser.role !== 'user' && (
                <Button 
                  onClick={() => router.push('/songs/new')} 
                  variant="outline" 
                  size="sm" 
                  className="w-9 px-0 sm:w-auto sm:px-4 shrink-0 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium h-9 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Add Song</span>
                </Button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={languageFilter || 'all'} onValueChange={handleLanguageChange}>
                <SelectTrigger className="flex-1 sm:w-[120px] shrink-0 border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 font-medium hover:bg-zinc-800 transition-colors px-2 sm:px-4">
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
                <SelectTrigger className="flex-1 sm:w-[110px] shrink-0 border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 font-medium hover:bg-zinc-800 transition-colors px-2 sm:px-4">
                  <SelectValue placeholder="Key" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-100">
                  <SelectItem value="all">All Keys</SelectItem>
                  {MUSICAL_KEYS.map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-8">
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
            <div className="overflow-x-auto border border-zinc-800/60 rounded-xl bg-zinc-950/30">
              <Table className="table-fixed w-full border-collapse">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[42%] px-2 sm:px-4 text-base">Title</TableHead>
                    <TableHead className="w-[28%] px-2 sm:px-4 text-base">Artist</TableHead>
                    <TableHead className="w-[15%] px-2 sm:px-4 text-base">Key</TableHead>
                    {hasActions && (
                      <TableHead className="w-[15%] px-2 sm:px-4 text-right text-base">
                        <span className="sr-only sm:not-sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSongs.map((song) => (
                    <TableRow
                      key={song.id}
                      className="cursor-pointer select-none"
                      onClick={() => handleRowClick(song.id)}
                      onTouchStart={() => handleTouchStart(song.id)}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchEnd}
                      onMouseDown={() => handleTouchStart(song.id)}
                      onMouseUp={handleTouchEnd}
                      onMouseLeave={handleTouchEnd}
                      onContextMenu={(e) => {
                        if (isLongPressRef.current) e.preventDefault();
                      }}
                    >
                      <TableCell className="font-medium px-2 sm:px-4 text-base">
                        <div className={expandedRow === song.id ? "whitespace-normal break-words" : "line-clamp-2"} title={song.title}>
                          {song.title}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 text-base">
                        <div className={expandedRow === song.id ? "whitespace-normal break-words" : "line-clamp-2"} title={song.artist}>
                          {song.artist}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap px-2 sm:px-4 text-base">
                        {getKeyDisplayName(songKeys[song.id]) || '-'}
                      </TableCell>
                      {hasActions && (
                        <TableCell className="text-right px-2 sm:px-4">
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4 text-zinc-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                {currentUser && (
                                  <>
                                    <div className="flex items-center gap-2 p-2 pb-0">
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
                                    </div>
                                    <div className="h-px bg-zinc-800 my-2" />
                                  </>
                                )}
                                {canEdit(song.createdBy) && (
                                  <>
                                    <DropdownMenuItem onClick={() => router.push(`/songs/edit?id=${song.id}`)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteSong(song.id)} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {currentUser && currentUser.role === 'super_admin' && song.organizationId && (
                                  <>
                                    <DropdownMenuItem onClick={() => {
                                      if (confirm(`Are you sure you want to MOVE "${song.title}" to the global library? It will no longer belong to this organization.`)) {
                                        makeSongGlobal(song.id);
                                      }
                                    }}>
                                      <Globe className="mr-2 h-4 w-4 text-blue-400" />
                                      <span>Move to Global</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      if (confirm(`Are you sure you want to COPY "${song.title}" to the global library? A duplicate will be created in the public library.`)) {
                                        copySongToGlobal(song.id);
                                      }
                                    }}>
                                      <Copy className="mr-2 h-4 w-4 text-green-400" />
                                      <span>Copy to Global</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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

