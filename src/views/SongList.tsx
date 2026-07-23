import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useAuth, authFetch } from '@/contexts/AuthContext';
import AddToGroupButton from '@/components/groups/AddToGroupButton';
import LikeButton from '@/components/songs/LikeButton';
import AddToPlaylistDialog from '@/components/playlists/AddToPlaylistDialog';
import { Pencil, Trash2, Globe, Lock, X, ArrowLeft, Heart, ListMusic, Copy, ChevronLeft, Plus, Music, MoreVertical, Settings, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { detectKey } from '@/lib/keyDetection';
import { getKeyDisplayName } from '@/lib/chordUtils';
import CopyToOrgButton from '@/components/organizations/CopyToOrgButton';
import TopContributors from '@/components/songs/TopContributors';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const SONGS_PER_PAGE = 25;

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [keyFilter, setKeyFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState<string | null>(searchParams.get('genre'));
  const [languageFilter, setLanguageFilter] = useState<string | null>(searchParams.get('language'));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [aiResults, setAiResults] = useState<string[] | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const aiDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // AI search: debounced call to /api/ai/search
  const performAiSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAiResults(null);
      setAiSearching(false);
      return;
    }
    setAiSearching(true);
    try {
      const res = await authFetch('/api/ai/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (res.ok && data.songIds) {
        setAiResults(data.songIds);
      } else {
        setAiResults([]);
      }
    } catch {
      setAiResults([]);
    } finally {
      setAiSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!isAiEnabled) {
      setAiResults(null);
      return;
    }
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    if (!searchQuery.trim()) {
      setAiResults(null);
      return;
    }
    aiDebounceRef.current = setTimeout(() => {
      performAiSearch(searchQuery);
    }, 600);
    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [searchQuery, isAiEnabled, performAiSearch]);

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
  const filteredSongs = useMemo(() => {
    // If AI search is active and has results, use those
    if (isAiEnabled && aiResults !== null) {
      // Preserve the order from AI (most relevant first)
      return aiResults
        .map(id => songs.find(s => s.id === id))
        .filter((s): s is typeof songs[number] => !!s);
    }

    return songs.filter(song => {
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

      // 4. Search query (normal mode)
      if (!isAiEnabled) {
        const q = searchQuery.toLowerCase().trim();
        if (q) {
          let matchesSearch = false;
          if (q.startsWith('key:')) {
            const keyQuery = q.substring(4).trim();
            matchesSearch = songKey.toLowerCase() === keyQuery;
          } else {
            const searchTokens = q.split(/\s+/).filter(Boolean);
            matchesSearch = searchTokens.every(token => 
              songKey.toLowerCase() === token ||
              song.title.toLowerCase().includes(token) ||
              song.artist.toLowerCase().includes(token) ||
              song.genre.some(g => g.toLowerCase().includes(token)) ||
              // Also match against song aliases (alternate titles)
              (song.aliases || []).some(alias => alias.toLowerCase().includes(token))
            );
          }
          if (!matchesSearch) return false;
        }
      }

      // 5. Tab filter
      if (activeFilter === 'global') return !song.organizationId;
      if (activeFilter === 'org') return !!song.organizationId;
      
      return true;
    });
  }, [songs, genreFilter, languageFilter, keyFilter, searchQuery, activeFilter, songKeys, isAiEnabled, aiResults]);

  // ─── Pagination ───
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / SONGS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSongs = useMemo(
    () => filteredSongs.slice((safePage - 1) * SONGS_PER_PAGE, safePage * SONGS_PER_PAGE),
    [filteredSongs, safePage]
  );

  // Back to first page whenever filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, genreFilter, languageFilter, keyFilter, activeFilter, isAiEnabled]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  const [pendingAction, setPendingAction] = useState<
    { kind: 'delete' | 'move' | 'copy'; songId: string; title: string } | null
  >(null);

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    const { kind, songId } = pendingAction;
    setPendingAction(null);
    try {
      if (kind === 'delete') await deleteSong(songId);
      else if (kind === 'move') await makeSongGlobal(songId);
      else await copySongToGlobal(songId);
    } catch (error) {
      console.error(`Failed to ${kind} song:`, error);
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
    <div className="bg-transparent pb-4 md:pb-8">
      {/* Header / Banner Area */}
      <div className="pt-24 md:pt-32 pb-8">
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
              <Badge variant="outline" className="border-zinc-800 text-zinc-400 uppercase tracking-widest text-[10px] font-semibold px-3 py-1 rounded-full w-fit">
                LIBRARY
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
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

      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 py-4 transition-all duration-300 ease-in-out">
        <div className="container mx-auto px-4 flex flex-col md:flex-row flex-wrap items-center justify-between gap-4">
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

          <div className="flex flex-col gap-2 w-full md:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {/* Search and Add Song Row */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <div className="relative flex-1 sm:w-[200px] flex items-center z-30">
                <Input
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder={isAiEnabled ? "Search with AI..." : "Search songs..."}
                  className={`w-full border-zinc-800 bg-zinc-900/60 text-zinc-100 rounded-full h-9 pl-4 pr-10 focus-visible:ring-1 focus-visible:ring-offset-0 transition-colors ${isAiEnabled ? 'focus-visible:ring-purple-500 border-purple-500/50' : 'focus-visible:ring-primary'}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {aiSearching ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </motion.div>
                  ) : isAiEnabled ? (
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Music className="w-4 h-4 text-zinc-500" />
                  )}
                </div>

                <AnimatePresence>
                  {isSearchFocused && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.15 }}
                      onMouseDown={(e) => e.preventDefault()} // Prevent input blur when clicking dropdown
                      className="absolute top-[calc(100%+8px)] left-0 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden flex flex-col"
                    >
                      <button
                        onClick={() => {
                          setIsAiEnabled(false);
                          setIsSearchFocused(false);
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left ${!isAiEnabled ? 'bg-zinc-800/50 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                      >
                        <Music className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col">
                          <span>Normal Search</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Search by title or lyrics</span>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setIsAiEnabled(true);
                          setIsSearchFocused(false);
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left border-t border-zinc-800/50 ${isAiEnabled ? 'bg-purple-500/10 text-purple-400 font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                      >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col">
                          <span>AI Search</span>
                          <span className="text-[10px] text-zinc-500 font-normal">Describe the song or mood</span>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {currentUser && (
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
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
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
          {activeFilter === 'global' && <TopContributors />}
          
          {loading ? (
            <div className="border border-zinc-800/60 rounded-xl bg-zinc-950/30 overflow-hidden">
              {/* Header skeleton */}
              <div className="bg-zinc-800 px-2 sm:px-4 py-3 flex items-center gap-3 sm:gap-4 border-b border-zinc-800/80">
                <Skeleton className="h-4 w-[38%] max-w-[160px]" />
                <Skeleton className="h-4 w-[24%] max-w-[110px]" />
                <Skeleton className="h-4 w-[12%] max-w-[60px]" />
                <Skeleton className="h-7 w-7 rounded-md ml-auto shrink-0" />
              </div>
              {/* Row skeletons */}
              <div className="divide-y divide-zinc-800/60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 px-2 sm:px-4 py-4">
                    <div className="w-[38%] space-y-1.5">
                      <Skeleton className="h-4 w-full max-w-[220px]" />
                      <Skeleton className="h-3 w-2/3 max-w-[140px] sm:hidden" />
                    </div>
                    <Skeleton className="h-4 w-[24%] max-w-[150px]" />
                    <Skeleton className="h-4 w-[10%] max-w-[40px]" />
                    <Skeleton className="h-8 w-8 rounded-full ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ) : aiSearching ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-6 h-6 text-purple-400" />
              </motion.div>
              <span className="text-sm">AI is searching...</span>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4 border border-zinc-800/60 rounded-xl bg-zinc-950/30">
              <div className="text-lg">
                {searchQuery
                  ? (isAiEnabled ? 'AI couldn\'t find matching songs. Try a different description.' : 'No songs match your search criteria')
                  : activeFilter === 'org'
                    ? 'No organization songs yet. Create one with the "Add Song" button!'
                    : 'No songs available. Add some songs to get started!'}
              </div>
              
              {searchQuery && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  {!isAiEnabled && (
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAiEnabled(true)}
                      className="gap-2 rounded-full border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/50 transition-all font-medium"
                    >
                      <Sparkles className="w-4 h-4" />
                      Try AI Search
                    </Button>
                  )}
                  
                  {currentUser && (
                    <Button 
                      onClick={() => router.push('/songs/new')} 
                      className="gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Song
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto border border-zinc-800/60 rounded-xl bg-zinc-950/30">
              <Table className="table-fixed w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-zinc-800 hover:bg-zinc-800 data-[state=selected]:bg-zinc-800 border-b border-zinc-800/80">
                    <TableHead className="w-[42%] px-2 sm:px-4 text-base">Title</TableHead>
                    <TableHead className="w-[28%] px-2 sm:px-4 text-base">Artist</TableHead>
                    <TableHead className="w-[15%] px-2 sm:px-4 text-base">Key</TableHead>
                    {hasActions && (
                      <TableHead className="w-[15%] px-2 sm:px-4 text-right">
                        <div className="flex justify-center items-center h-8 w-8 ml-auto">
                          <Settings className="w-4 h-4 text-zinc-500" />
                          <span className="sr-only">Actions</span>
                        </div>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSongs.map((song) => (
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
                                    <DropdownMenuItem onClick={() => setPendingAction({ kind: 'delete', songId: song.id, title: song.title })} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {currentUser && currentUser.role === 'super_admin' && song.organizationId && (
                                  <>
                                    <DropdownMenuItem onClick={() => setPendingAction({ kind: 'move', songId: song.id, title: song.title })}>
                                      <Globe className="mr-2 h-4 w-4 text-blue-400" />
                                      <span>Move to Global</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setPendingAction({ kind: 'copy', songId: song.id, title: song.title })}>
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

              {totalPages > 1 && (
                <div className="py-3 border-t border-zinc-800/60">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          className={`cursor-pointer select-none ${safePage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                          onClick={() => goToPage(safePage - 1)}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink
                          className="pointer-events-none select-none min-w-[2.5rem]"
                          isActive
                          aria-current="page"
                        >
                          {safePage}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          className={`cursor-pointer select-none ${safePage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                          onClick={() => goToPage(safePage + 1)}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
      </div>

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        destructive={pendingAction?.kind === 'delete'}
        icon={pendingAction?.kind === 'delete' ? <Trash2 /> : pendingAction?.kind === 'move' ? <Globe /> : <Copy />}
        title={
          pendingAction?.kind === 'delete' ? 'Delete Song'
          : pendingAction?.kind === 'move' ? 'Move to Global Library'
          : 'Copy to Global Library'
        }
        description={
          pendingAction?.kind === 'delete'
            ? <>This will permanently delete <span className="font-bold text-white">"{pendingAction?.title}"</span>. This action cannot be undone.</>
            : pendingAction?.kind === 'move'
              ? <>"{pendingAction?.title}" will be moved to the global library and will no longer belong to this organization.</>
              : <>A duplicate of "{pendingAction?.title}" will be created in the public library.</>
        }
        confirmLabel={
          pendingAction?.kind === 'delete' ? 'Delete'
          : pendingAction?.kind === 'move' ? 'Move' : 'Copy'
        }
        onConfirm={handleConfirmPendingAction}
      />
    </div>
  );
};

export default SongList;

