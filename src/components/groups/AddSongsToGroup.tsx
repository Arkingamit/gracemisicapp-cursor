import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSongs } from '@/contexts/SongContext';
import { detectKey } from '@/lib/keyDetection';
import { useGroups } from '@/contexts/groups';
import { useAuth, authFetch } from '@/contexts/AuthContext';
import { Sparkles, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { DEFAULT_PAGE_SIZE, getPageNumbers } from '@/lib/pagination';

const MUSICAL_KEYS = [
  // Major keys
  'C', 'C# / Db', 'D', 'D# / Eb', 'E', 'F', 'F# / Gb', 'G', 'G# / Ab', 'A', 'A# / Bb', 'B',
  // Minor keys
  'Cm', 'C#m / Dbm', 'Dm', 'D#m / Ebm', 'Em', 'Fm', 'F#m / Gbm', 'Gm', 'G#m / Abm', 'Am', 'A#m / Bbm', 'Bm'
];

interface AddSongsToGroupProps {
  groupId: string;
  existingSongIds: string[];
  onCancel: () => void;
}

const AddSongsToGroup = ({ groupId, existingSongIds, onCancel }: AddSongsToGroupProps) => {
  const { songs } = useSongs();
  const { addSongToGroup } = useGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AI search state
  const { currentUser } = useAuth();
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [aiResults, setAiResults] = useState<string[] | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const aiDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const router = useRouter();
  
  // Filter out songs that are already in the group
  const availableSongs = songs.filter(song => !existingSongIds.includes(song.id));
  
  // Pre-calculate keys
  const songKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    availableSongs.forEach(song => {
      keys[song.id] = song.originalKey || detectKey(song.lyrics);
    });
    return keys;
  }, [availableSongs]);

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    availableSongs.forEach(song => {
      if (song.language) langs.add(song.language);
    });
    return Array.from(langs).sort();
  }, [availableSongs]);

  // AI search function
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

  // Apply search and dropdown filters
  const filteredSongs = useMemo(() => {
    if (isAiEnabled && aiResults !== null) {
      return aiResults
        .map(id => availableSongs.find(s => s.id === id))
        .filter((s): s is typeof availableSongs[number] => !!s);
    }

    return availableSongs.filter(song => {
    // 1. Language filter
    if (languageFilter !== 'all' && song.language?.toLowerCase() !== languageFilter.toLowerCase()) {
      return false;
    }

    const songKey = songKeys[song.id] || '';
    
    // 2. Key filter
    if (keyFilter !== 'all') {
      const allowedKeys = keyFilter.split(/ \/ /);
      if (!allowedKeys.includes(songKey)) {
        return false;
      }
    }

    // 3. Text search
    if (!isAiEnabled) {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      
      if (q.startsWith('key:')) {
        return songKey.toLowerCase() === q.substring(4).trim();
      }
    
      const searchTokens = q.split(/\s+/).filter(Boolean);
      return searchTokens.every(token => 
        songKey.toLowerCase() === token || // exact key match
        song.title.toLowerCase().includes(token) ||
        song.artist.toLowerCase().includes(token) ||
        song.genre.some(g => g.toLowerCase().includes(token)) ||
        (song.aliases || []).some(alias => alias.toLowerCase().includes(token))
      );
    }
    return true;
  });
  }, [availableSongs, languageFilter, keyFilter, searchQuery, songKeys, isAiEnabled, aiResults]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / DEFAULT_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSongs = useMemo(
    () => filteredSongs.slice((safePage - 1) * DEFAULT_PAGE_SIZE, safePage * DEFAULT_PAGE_SIZE),
    [filteredSongs, safePage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, keyFilter, languageFilter, isAiEnabled]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };
  
  const handleToggleSelection = (songId: string) => {
    const newSelection = new Set(selectedSongs);
    if (newSelection.has(songId)) {
      newSelection.delete(songId);
    } else {
      newSelection.add(songId);
    }
    setSelectedSongs(newSelection);
  };
  
  const handleAddSongs = async () => {
    if (selectedSongs.size === 0) return;

    setIsSubmitting(true);
    const songIds = Array.from(selectedSongs);
    // Optimistic updates land immediately — navigate without waiting on the network
    router.push(`/groups/view?id=${groupId}`);

    const results = await Promise.allSettled(
      songIds.map((songId) => addSongToGroup(groupId, songId))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      console.error(`Failed to add ${failed} of ${songIds.length} songs to group`);
    }
    setIsSubmitting(false);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Add Songs to Song Set</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            size="sm"
            disabled={selectedSongs.size === 0 || isSubmitting} 
            onClick={handleAddSongs}
            className="bg-zinc-700 hover:bg-zinc-600 text-white"
          >
            {isSubmitting 
              ? 'Adding...' 
              : `Add ${selectedSongs.size} ${selectedSongs.size === 1 ? 'Song' : 'Songs'}`}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Langs</SelectItem>
              {availableLanguages.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={keyFilter} onValueChange={setKeyFilter}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Key" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Keys</SelectItem>
              {MUSICAL_KEYS.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {aiSearching ? (
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
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4 border border-zinc-800/60 rounded-xl bg-zinc-950/30 mt-4">
            <div className="text-lg">
              {availableSongs.length === 0 
                ? 'No songs available to add to this song set' 
                : searchQuery
                  ? (isAiEnabled ? 'AI couldn\'t find matching songs. Try a different description.' : 'No songs match your search criteria')
                  : 'No songs available to add to this song set'}
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
          <div className="overflow-x-auto border border-zinc-800/60 rounded-xl bg-zinc-950/30 mt-4">
            <Table className="table-fixed w-full border-collapse">
              <TableHeader>
                <TableRow className="bg-zinc-800 hover:bg-zinc-800 data-[state=selected]:bg-zinc-800 border-b border-zinc-800/80">
                  <TableHead className="w-[50px] px-2 sm:px-4 text-center">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead className="w-[42%] px-2 sm:px-4 text-base">Title</TableHead>
                  <TableHead className="w-[28%] px-2 sm:px-4 text-base">Artist</TableHead>
                  <TableHead className="w-[15%] px-2 sm:px-4 text-base">Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSongs.map((song) => (
                  <TableRow 
                    key={song.id}
                    className="cursor-pointer select-none transition-colors"
                    onClick={() => handleToggleSelection(song.id)}
                  >
                    <TableCell className="px-2 sm:px-4">
                      <div className="flex justify-center items-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedSongs.has(song.id)}
                          onCheckedChange={() => handleToggleSelection(song.id)}
                          className="h-5 w-5"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium px-2 sm:px-4 text-base">
                      <div className="line-clamp-2" title={song.title}>
                        {song.title}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 text-base">
                      <div className="line-clamp-2" title={song.artist}>
                        {song.artist}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap px-2 sm:px-4 text-base">
                      {songKeys[song.id] || '-'}
                    </TableCell>
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
                    {getPageNumbers(safePage, totalPages).map((p, idx) =>
                      p === 'ellipsis' ? (
                        <PaginationItem key={`e-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            className="cursor-pointer select-none"
                            isActive={p === safePage}
                            onClick={() => goToPage(p)}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
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
      </CardContent>

    </Card>
  );
};

export default AddSongsToGroup;
