import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song } from '@/lib/types';
import { authFetch, useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, RefreshCw, Sparkles, Loader2, AlertTriangle, CheckCircle2, Eye, Pencil, Flag, Search, Plus } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LyricsDisplay from '@/components/songs/LyricsDisplay';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import RejectSongDialog, { RejectSongPayload } from '@/components/admin/RejectSongDialog';
import { hasAnyRole } from '@/lib/roles';
import ReportSongModal from '@/components/songs/ReportSongModal';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedSongId?: string | null;
  matchedTitle?: string | null;
  confidence?: string;
  reason?: string;
  error?: string;
  similarSongs?: { id: string; title: string; artist?: string; aliases?: string[] }[];
}

type LibraryHit = { id: string; title: string; artist?: string; aliases?: string[] };

const QUEUE_PAGE_SIZE = 10;

/** Page numbers to render: 1 … around current … last */
const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
};

type CheckState = 'idle' | 'checking' | 'done';

// The workflow step for each song card
type WorkflowStep = 'initial' | 'ai-result' | 'review';

interface SongCheckState {
  state: CheckState;
  result?: DuplicateCheckResult;
}

const AdminVerificationQueue = () => {
  const [pendingSongs, setPendingSongs] = useState<Song[]>([]);
  const [queuePage, setQueuePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [checkStates, setCheckStates] = useState<Record<string, SongCheckState>>({});
  const [addingAliasId, setAddingAliasId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { refreshUser } = useAuth();

  /** Re-verify verifier/editor access before every privileged action (not only on page enter). */
  const ensureVerifierAccess = useCallback(async (): Promise<boolean> => {
    const user = await refreshUser();
    if (!user || !hasAnyRole(user, 'verifier', 'editor')) {
      toast({
        title: 'Access Denied',
        description: "You don't have permission to perform this action",
        variant: 'destructive',
      });
      router.push('/');
      return false;
    }
    return true;
  }, [refreshUser, router, toast]);
  
  // Per-song workflow step
  const [workflowSteps, setWorkflowSteps] = useState<Record<string, WorkflowStep>>({});

  // Preview/Edit state
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const [expandedSong, setExpandedSong] = useState<Song | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'preview' | 'edit'>('preview');
  const [editLyrics, setEditLyrics] = useState('');
  const [savingLyrics, setSavingLyrics] = useState(false);

  // Similar song inline preview
  const [expandedSimilarId, setExpandedSimilarId] = useState<string | null>(null);
  const [expandedSimilarSong, setExpandedSimilarSong] = useState<Song | null>(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Manual library search (per pending song)
  const [manualQueries, setManualQueries] = useState<Record<string, string>>({});
  const [manualResults, setManualResults] = useState<Record<string, LibraryHit[]>>({});
  const [manualSearching, setManualSearching] = useState<Record<string, boolean>>({});
  const [manualAiEnabled, setManualAiEnabled] = useState<Record<string, boolean>>({});
  const searchDebounceRefs = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  // Reject / Report dialogs
  const [rejectTarget, setRejectTarget] = useState<Song | null>(null);
  const [reportTarget, setReportTarget] = useState<Song | null>(null);

  const runLibrarySearch = useCallback(async (pendingSongId: string, query: string, useAi: boolean) => {
    const q = query.trim();
    if (!q) {
      setManualResults((prev) => ({ ...prev, [pendingSongId]: [] }));
      setManualSearching((prev) => ({ ...prev, [pendingSongId]: false }));
      return;
    }

    if (!(await ensureVerifierAccess())) return;

    setManualSearching((prev) => ({ ...prev, [pendingSongId]: true }));
    try {
      if (useAi) {
        const aiRes = await authFetch('/api/ai/search', {
          method: 'POST',
          body: JSON.stringify({ query: q }),
        });
        const aiData = await aiRes.json();
        if (!aiRes.ok) {
          toast({
            title: 'AI search failed',
            description: aiData.error || 'Could not run AI search',
            variant: 'destructive',
          });
          setManualResults((prev) => ({ ...prev, [pendingSongId]: [] }));
          return;
        }
        const songIds: string[] = Array.isArray(aiData.songIds) ? aiData.songIds : [];
        if (songIds.length === 0) {
          setManualResults((prev) => ({ ...prev, [pendingSongId]: [] }));
          return;
        }
        const hydrateRes = await authFetch(
          `/api/songs/search?ids=${encodeURIComponent(songIds.slice(0, 25).join(','))}`
        );
        if (hydrateRes.ok) {
          const data = await hydrateRes.json();
          setManualResults((prev) => ({ ...prev, [pendingSongId]: data.songs || [] }));
        } else {
          setManualResults((prev) => ({ ...prev, [pendingSongId]: [] }));
        }
      } else {
        if (q.length < 1) {
          setManualResults((prev) => ({ ...prev, [pendingSongId]: [] }));
          return;
        }
        const res = await authFetch(`/api/songs/search?q=${encodeURIComponent(q)}&limit=25`);
        if (res.ok) {
          const data = await res.json();
          setManualResults((prev) => ({ ...prev, [pendingSongId]: data.songs || [] }));
        } else {
          const data = await res.json();
          toast({ title: 'Search failed', description: data.error || 'Could not search library', variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Search failed', description: 'Could not search library', variant: 'destructive' });
    } finally {
      setManualSearching((prev) => ({ ...prev, [pendingSongId]: false }));
    }
  }, [toast, ensureVerifierAccess]);

  const scheduleLibrarySearch = useCallback(
    (pendingSongId: string, query: string, useAi: boolean) => {
      const existing = searchDebounceRefs.current[pendingSongId];
      if (existing) clearTimeout(existing);

      if (!query.trim()) {
        setManualResults((prev) => ({ ...prev, [pendingSongId]: [] }));
        setManualSearching((prev) => ({ ...prev, [pendingSongId]: false }));
        return;
      }

      // Show searching indicator while waiting for debounce on longer AI calls
      if (useAi || query.trim().length >= 2) {
        setManualSearching((prev) => ({ ...prev, [pendingSongId]: true }));
      }

      searchDebounceRefs.current[pendingSongId] = setTimeout(() => {
        runLibrarySearch(pendingSongId, query, useAi);
      }, useAi ? 600 : 300);
    },
    [runLibrarySearch]
  );

  useEffect(() => {
    return () => {
      Object.values(searchDebounceRefs.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  const handleExpandSimilar = async (id: string) => {
    if (expandedSimilarId === id) {
      setExpandedSimilarId(null);
      setExpandedSimilarSong(null);
      return;
    }
    setExpandedSimilarId(id);
    setLoadingSimilar(true);
    try {
      const res = await fetch(`/api/songs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedSimilarSong(data.song);
      }
    } catch (e) {
      console.error('Failed to load similar song', e);
    } finally {
      setLoadingSimilar(false);
    }
  };

  /** Preview a library match side-by-side with the pending submission */
  const handleCompareSimilar = (id: string, pendingSong: Song) => {
    // Ensure the pending song lyrics are loaded for the left pane
    if (expandedSimilarId !== id && expandedSongId !== pendingSong.id) {
      handleExpandPreview(pendingSong);
    }
    handleExpandSimilar(id);
  };

  const renderMatchRow = (
    pendingSong: Song,
    hit: LibraryHit,
    options?: { bestMatch?: boolean; highlight?: boolean; ai?: boolean }
  ) => (
    <li
      key={hit.id}
      className={`rounded-lg border overflow-hidden transition-colors ${
        expandedSimilarId === hit.id
          ? 'bg-white/[0.07] border-zinc-500 ring-1 ring-zinc-500/50'
          : options?.bestMatch
            ? 'bg-black/20 border-orange-500/20'
            : options?.highlight
              ? 'bg-black/20 border-blue-500/20'
              : 'bg-black/20 border-white/5'
      }`}
    >
      <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
        {/* Title + artist */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {options?.bestMatch && (
            <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] px-1.5 shrink-0">
              Best Match
            </Badge>
          )}
          {options?.highlight && !options?.bestMatch && (
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] px-1.5 shrink-0">
              {options?.ai ? 'AI' : 'Search'}
            </Badge>
          )}
          <div className="min-w-0">
            <p className="text-xs text-zinc-200 font-medium truncate">{hit.title}</p>
            {hit.artist && (
              <p className="text-[10px] text-zinc-500 truncate">{hit.artist}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] font-bold border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-white focus:bg-zinc-900/60 focus:text-zinc-300 focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-zinc-900/60"
            onClick={(e) => {
              e.currentTarget.blur();
              handleCompareSimilar(hit.id, pendingSong);
            }}
          >
            <Eye className="w-3 h-3 mr-1" />
            {expandedSimilarId === hit.id ? 'Hide' : 'Preview'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={`gap-1 text-[10px] font-bold h-6 px-2 border-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white ${
              options?.bestMatch ? 'bg-zinc-700/80' : 'bg-zinc-800/80'
            }`}
            onClick={() => handleAddAlias(pendingSong.id, hit.id, pendingSong.title)}
            disabled={addingAliasId === pendingSong.id}
          >
            {addingAliasId === pendingSong.id && <Loader2 className="w-3 h-3 animate-spin" />}
            Add as duplicate
          </Button>
        </div>
      </div>
    </li>
  );

  /** Side-by-side comparison panel: pending submission (left) vs library match (right) */
  const renderComparePanel = (pendingSong: Song) => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 rounded-lg border border-white/10 bg-black/30 overflow-hidden"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
        {/* Left pane: pending submission */}
        <div className="flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 bg-zinc-900/60 flex items-center gap-2">
            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[9px] px-1.5 shrink-0">
              Pending
            </Badge>
            <span className="text-xs font-semibold text-zinc-200 truncate flex-1">
              {pendingSong.title}
            </span>
            {expandedSongId === pendingSong.id && !loadingPreview && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant={previewMode === 'preview' ? 'secondary' : 'ghost'}
                  onClick={() => setPreviewMode('preview')}
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  <Eye className="w-3 h-3" /> View
                </Button>
                <Button
                  size="sm"
                  variant={previewMode === 'edit' ? 'secondary' : 'ghost'}
                  onClick={() => setPreviewMode('edit')}
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </Button>
              </div>
            )}
          </div>
          <div className="p-3 h-[420px] overflow-y-auto overflow-x-auto">
            {expandedSongId === pendingSong.id ? (
              loadingPreview ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                </div>
              ) : previewMode === 'edit' ? (
                <div className="flex flex-col gap-3 h-[390px]">
                  <Textarea
                    value={editLyrics}
                    onChange={(e) => setEditLyrics(e.target.value)}
                    className="flex-1 font-mono text-xs bg-zinc-950 border-zinc-800 resize-none"
                    placeholder="Enter lyrics and chords here..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditLyrics(expandedSong?.lyrics || '');
                        setPreviewMode('preview');
                      }}
                      disabled={savingLyrics}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleSaveLyrics}
                      disabled={savingLyrics || editLyrics === expandedSong?.lyrics}
                    >
                      {savingLyrics && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : expandedSong?.lyrics ? (
                <LyricsDisplay lyrics={expandedSong.lyrics} columns={1} noWrap />
              ) : (
                <p className="text-xs text-zinc-400">No lyrics available.</p>
              )
            ) : (
              <button
                onClick={() => handleExpandPreview(pendingSong)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Show pending lyrics
              </button>
            )}
          </div>
        </div>

        {/* Right pane: library match */}
        <div className="flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 bg-zinc-900/60 flex items-center gap-2">
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] px-1.5 shrink-0">
              Library
            </Badge>
            <span className="text-xs font-semibold text-zinc-200 truncate">
              {expandedSimilarSong?.title || 'Possible match'}
            </span>
          </div>
          <div className="p-3 h-[420px] overflow-y-auto overflow-x-auto">
            {expandedSimilarId ? (
              loadingSimilar ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                </div>
              ) : expandedSimilarSong?.lyrics ? (
                <LyricsDisplay lyrics={expandedSimilarSong.lyrics} columns={1} noWrap />
              ) : (
                <p className="text-xs text-zinc-400">No lyrics available.</p>
              )
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">
                Click Preview on a match to compare it here.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderManualSearch = (pendingSong: Song, excludeIds: Set<string> = new Set()) => {
    const query = manualQueries[pendingSong.id] || '';
    const searching = !!manualSearching[pendingSong.id];
    const aiOn = !!manualAiEnabled[pendingSong.id];
    const results = (manualResults[pendingSong.id] || []).filter((s) => !excludeIds.has(s.id));
    const hasQuery = query.trim().length > 0;

    return (
      <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
        <div className="flex items-start gap-2">
          <Search className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-zinc-200">Search library manually</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Results update as you type. Switch to AI Search for natural-language matching.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setManualQueries((prev) => ({ ...prev, [pendingSong.id]: next }));
                scheduleLibrarySearch(pendingSong.id, next, aiOn);
              }}
              placeholder={aiOn ? 'Search with AI…' : 'Search title, artist, or alias…'}
              className={`pl-8 pr-10 h-9 text-xs bg-zinc-950 ${
                aiOn
                  ? 'border-purple-500/40 focus-visible:ring-purple-500/40'
                  : 'border-white/10'
              }`}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`p-1.5 rounded-md transition-colors ${
                      aiOn
                        ? 'text-purple-400 bg-purple-500/10'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                    title={aiOn ? 'AI Search on' : 'Search mode'}
                  >
                    {searching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-zinc-950 border-white/10">
                  <DropdownMenuItem
                    className={!aiOn ? 'bg-white/5 text-white' : 'text-zinc-400'}
                    onClick={() => {
                      setManualAiEnabled((prev) => ({ ...prev, [pendingSong.id]: false }));
                      scheduleLibrarySearch(pendingSong.id, query, false);
                    }}
                  >
                    <Search className="w-3.5 h-3.5 mr-2" />
                    Normal search
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={aiOn ? 'bg-purple-500/10 text-purple-300' : 'text-zinc-400'}
                    onClick={() => {
                      setManualAiEnabled((prev) => ({ ...prev, [pendingSong.id]: true }));
                      scheduleLibrarySearch(pendingSong.id, query, true);
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    AI Search
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {aiOn && (
          <p className="text-[10px] text-purple-400/80 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI Search active — describe the song in natural language
          </p>
        )}

        {hasQuery && (
          searching && results.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {aiOn ? 'AI is searching…' : 'Searching…'}
            </div>
          ) : results.length > 0 ? (
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {results.map((hit) =>
                renderMatchRow(pendingSong, hit, {
                  highlight: true,
                  ai: aiOn,
                })
              )}
            </ul>
          ) : (
            !searching && (
              <p className="text-xs text-zinc-500 italic">
                {aiOn
                  ? 'AI couldn’t find matching songs. Try a different description.'
                  : `No songs matched “${query.trim()}”.`}
              </p>
            )
          )
        )}
      </div>
    );
  };

  /** Always opens the preview for the given song (no toggle) */
  const openPreview = async (song: Song) => {
    setExpandedSongId(song.id);
    setLoadingPreview(true);
    setPreviewMode('preview');
    try {
      const res = await fetch(`/api/songs/${song.id}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedSong(data.song);
        setEditLyrics(data.song.lyrics || '');
      }
    } catch (e) {
      console.error('Failed to load preview', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExpandPreview = async (song: Song) => {
    if (expandedSongId === song.id) {
      setExpandedSongId(null);
      setExpandedSong(null);
      return;
    }
    await openPreview(song);
  };

  const handleSaveLyrics = async () => {
    if (!expandedSong) return;
    if (!(await ensureVerifierAccess())) return;
    setSavingLyrics(true);
    try {
      const res = await authFetch(`/api/songs/${expandedSong.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lyrics: editLyrics }),
      });
      if (res.ok) {
        setExpandedSong({ ...expandedSong, lyrics: editLyrics });
        setPreviewMode('preview');
        toast({ title: "Success", description: "Lyrics updated successfully." });
      } else {
        toast({ title: "Error", description: "Failed to update lyrics.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "An error occurred.", variant: "destructive" });
    } finally {
      setSavingLyrics(false);
    }
  };

  const fetchPendingSongs = async () => {
    if (!(await ensureVerifierAccess())) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/songs?status=pending&limit=100');
      if (res.ok) {
        const data = await res.json();
        setPendingSongs(data.songs || []);
      } else {
        toast({ title: 'Error', description: 'Failed to fetch pending songs', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPendingSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const handleVerify = async (
    id: string,
    status: 'approved' | 'rejected',
    rejectPayload?: RejectSongPayload
  ) => {
    if (!(await ensureVerifierAccess())) return;
    setProcessingId(id);
    try {
      const body: Record<string, unknown> = { status };
      if (status === 'rejected' && rejectPayload) {
        body.rejectionCategory = rejectPayload.rejectionCategory;
        body.rejectionMessage = rejectPayload.rejectionMessage;
        body.reportUserAsSpammer = rejectPayload.reportUserAsSpammer;
      }

      const res = await authFetch(`/api/songs/${id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: status === 'rejected' && rejectPayload?.reportUserAsSpammer
            ? 'Song rejected and contributor flagged for spam'
            : `Song ${status} successfully`,
        });
        setPendingSongs(prev => prev.filter(song => song.id !== id));
        setCheckStates(prev => { const n = { ...prev }; delete n[id]; return n; });
        setWorkflowSteps(prev => { const n = { ...prev }; delete n[id]; return n; });
        setRejectTarget(null);
        window.dispatchEvent(new Event('pendingSongProcessed'));
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || `Failed to ${status} song`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCheckDuplicate = async (song: Song) => {
    if (!(await ensureVerifierAccess())) return;
    setCheckStates(prev => ({ ...prev, [song.id]: { state: 'checking' } }));
    try {
      const res = await authFetch(`/api/songs/${song.id}/check-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // If the song is no longer pending, remove it from the list
      if (!res.ok) {
        const errData = await res.json();
        if (errData.error?.includes('not in pending state')) {
          toast({ title: 'Removed', description: `"${song.title}" is no longer pending and has been removed from the queue.` });
          setPendingSongs(prev => prev.filter(s => s.id !== song.id));
          setCheckStates(prev => { const n = { ...prev }; delete n[song.id]; return n; });
          setWorkflowSteps(prev => { const n = { ...prev }; delete n[song.id]; return n; });
          window.dispatchEvent(new Event('pendingSongProcessed'));
          return;
        }
        throw new Error(errData.error || 'Check failed. Try again.');
      }

      const result: DuplicateCheckResult = await res.json();
      setCheckStates(prev => ({ ...prev, [song.id]: { state: 'done', result } }));
      // Move to the ai-result step with the pending song preview open by default
      setWorkflowSteps(prev => ({ ...prev, [song.id]: 'ai-result' }));
      openPreview(song);
    } catch (error: any) {
      setCheckStates(prev => ({
        ...prev,
        [song.id]: { state: 'done', result: { isDuplicate: false, error: error?.message || 'Check failed. Try again.' } }
      }));
      setWorkflowSteps(prev => ({ ...prev, [song.id]: 'ai-result' }));
      openPreview(song);
    }
  };

  const handleAddAlias = async (pendingSongId: string, canonicalSongId: string, aliasTitle: string) => {
    if (!(await ensureVerifierAccess())) return;
    setAddingAliasId(pendingSongId);
    try {
      const res = await authFetch(`/api/songs/${pendingSongId}/add-alias`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalSongId, aliasTitle }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: '✅ Alias Added',
          description: data.message,
        });
        setPendingSongs(prev => prev.filter(song => song.id !== pendingSongId));
        setCheckStates(prev => { const n = { ...prev }; delete n[pendingSongId]; return n; });
        setWorkflowSteps(prev => { const n = { ...prev }; delete n[pendingSongId]; return n; });
        window.dispatchEvent(new Event('pendingSongProcessed'));
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to add alias', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An error occurred', variant: 'destructive' });
    } finally {
      setAddingAliasId(null);
    }
  };

  const getConfidenceColor = (confidence?: string) => {
    if (confidence === 'high') return 'text-red-400 border-red-500/30 bg-red-500/10';
    if (confidence === 'medium') return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  };

  // Go to the review step (View & Edit, then Approve/Reject)
  const goToReview = (songId: string, song: Song) => {
    setWorkflowSteps(prev => ({ ...prev, [songId]: 'review' }));
    // Auto-expand the preview (skip if already open, since handleExpandPreview toggles)
    if (expandedSongId !== song.id) {
      handleExpandPreview(song);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-white/5 bg-black/20 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-40 max-w-[60%]" />
                    <Skeleton className="h-4 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Skeleton className="h-8 w-20 rounded-md" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (pendingSongs.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-10 h-10 text-green-500/50 mx-auto mb-3" />
        <p className="text-zinc-400 mb-4">No songs are currently pending verification.</p>
        <Button variant="outline" size="sm" onClick={fetchPendingSongs}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  const totalQueuePages = Math.max(1, Math.ceil(pendingSongs.length / QUEUE_PAGE_SIZE));
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const pagedPendingSongs = pendingSongs.slice(
    (safeQueuePage - 1) * QUEUE_PAGE_SIZE,
    safeQueuePage * QUEUE_PAGE_SIZE
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-zinc-400">
          <span className="font-semibold text-white">{pendingSongs.length}</span> song{pendingSongs.length !== 1 ? 's' : ''} awaiting review
        </p>
        <Button variant="outline" size="sm" onClick={fetchPendingSongs}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {pagedPendingSongs.map((song) => {
          const check = checkStates[song.id];
          const isChecking = check?.state === 'checking';
          const hasResult = check?.state === 'done';
          const result = check?.result;
          const isProcessing = processingId === song.id;
          const step = workflowSteps[song.id] || 'initial';

          return (
            <motion.div
              key={song.id}
              layout
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden"
            >
              {/* Song header row */}
              <div className="flex items-start sm:items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white truncate">{song.title}</span>
                    {song.language && (
                      <Badge variant="outline" className="text-[10px] px-1.5 border-zinc-700 text-zinc-400">
                        {song.language}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {song.artist || 'Unknown Artist'} &nbsp;·&nbsp;
                    {formatDistanceToNow(new Date(song.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* STEP 1: Initial — Preview + "Check AI" buttons */}
                {step === 'initial' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                      onClick={() => handleExpandPreview(song)}
                      disabled={isProcessing}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {expandedSongId === song.id ? 'Hide' : 'Preview'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                      onClick={() => handleCheckDuplicate(song)}
                      disabled={isChecking || isProcessing}
                    >
                      {isChecking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {isChecking ? 'Checking...' : 'Check AI'}
                    </Button>
                  </div>
                )}

                {/* STEP 2: AI Result — Re-check button (preview is always open below) */}
                {step === 'ai-result' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-zinc-500 hover:text-zinc-300"
                      onClick={() => handleCheckDuplicate(song)}
                      disabled={isChecking || isProcessing}
                    >
                      <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                      Re-check
                    </Button>
                  </div>
                )}

                {/* STEP 3: Review — show Approve/Reject */}
                {step === 'review' && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-400 border-green-500/20"
                      onClick={() => handleVerify(song.id, 'approved')}
                      disabled={isProcessing}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 border-red-500/20"
                      onClick={() => setRejectTarget(song)}
                      disabled={isProcessing}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/20"
                      onClick={() => setReportTarget(song)}
                      disabled={isProcessing}
                    >
                      <Flag className="w-3.5 h-3.5 mr-1" /> Report
                    </Button>
                  </div>
                )}
              </div>

              {/* ===== STEP 2 BODY: AI Duplicate Check Result ===== */}
              <AnimatePresence>
                {step === 'ai-result' && hasResult && result && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {result.error ? (
                      <div className="mx-4 mb-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-zinc-400">
                        ⚠️ {result.error}
                      </div>
                    ) : (
                      <>
                        {/* Similar songs list (always shown if there are any) */}
                        {result.similarSongs && result.similarSongs.length > 0 && (
                          <div className="mx-4 mb-4 p-4 rounded-lg border border-zinc-700/40 bg-zinc-800/30">
                            <div className="flex items-start gap-2 mb-3">
                              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-400" />
                              <div>
                                <p className="font-semibold text-sm text-zinc-200">
                                  Possible matches found in your library
                                  {result.isDuplicate && result.confidence && (
                                    <span className="ml-2 font-normal opacity-70 text-xs uppercase tracking-wide">
                                      ({result.confidence} confidence)
                                    </span>
                                  )}
                                </p>
                                {result.reason && <p className="text-xs mt-1 text-zinc-400">{result.reason}</p>}
                              </div>
                            </div>

                            {/* Combined list: matched song + similar songs */}
                            <ul className="space-y-1.5 mb-4">
                              {result.matchedSongId && result.matchedTitle && (
                                renderMatchRow(
                                  song,
                                  { id: result.matchedSongId, title: result.matchedTitle },
                                  { bestMatch: true }
                                )
                              )}

                              {result.similarSongs
                                .filter((s) => s.id !== result.matchedSongId)
                                .map((s) => renderMatchRow(song, s))}
                            </ul>

                            {renderManualSearch(
                              song,
                              new Set([
                                ...(result.matchedSongId ? [result.matchedSongId] : []),
                                ...result.similarSongs.map((s) => s.id),
                              ])
                            )}

                            {/* Side-by-side preview: pending vs library match */}
                            <AnimatePresence>
                              {(expandedSongId === song.id ||
                                (expandedSimilarId &&
                                  (result.matchedSongId === expandedSimilarId ||
                                    result.similarSongs.some((s) => s.id === expandedSimilarId) ||
                                    (manualResults[song.id] || []).some(
                                      (s) => s.id === expandedSimilarId
                                    )))) &&
                                renderComparePanel(song)}
                            </AnimatePresence>

                            {/* YES / NO decision buttons */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-3 border-t border-white/5 mt-4">
                              <p className="text-xs text-zinc-400 flex-1">Is this song already in the list above?</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 font-bold text-zinc-100 border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white h-auto min-h-8 py-1.5 max-w-full w-full sm:w-auto whitespace-normal"
                                onClick={() => goToReview(song.id, song)}
                              >
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-left">
                                  Add &quot;{song.title}&quot; as a new song
                                </span>
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* No similar songs at all */}
                        {(!result.similarSongs || result.similarSongs.length === 0) && !result.isDuplicate && (
                          <div className="mx-4 mb-4 space-y-3">
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-400 text-sm">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>
                                <strong>No duplicate found.</strong>
                                {result.reason && <span className="opacity-70 ml-1">{result.reason}</span>}
                              </span>
                            </div>

                            <div className="p-4 rounded-lg border border-zinc-700/40 bg-zinc-800/30">
                              {renderManualSearch(song)}

                              {/* Side-by-side preview: pending vs library match */}
                              <AnimatePresence>
                                {(expandedSongId === song.id ||
                                  (expandedSimilarId &&
                                    (manualResults[song.id] || []).some(
                                      (s) => s.id === expandedSimilarId
                                    ))) &&
                                  renderComparePanel(song)}
                              </AnimatePresence>

                              <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-blue-400 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 h-8"
                                  onClick={() => goToReview(song.id, song)}
                                >
                                  <Eye className="w-3.5 h-3.5" /> View & Review
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ===== Song preview body — View/Edit lyrics (in ai-result step the side-by-side panel is used instead) ===== */}
              <AnimatePresence>
                {expandedSongId === song.id &&
                  !(step === 'ai-result' && hasResult && result && !result.error) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-zinc-800/60 bg-zinc-900/20 overflow-hidden"
                  >
                    <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto">
                      {loadingPreview ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                        </div>
                      ) : (
                        <div className="flex flex-col h-full">
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                            <h3 className="font-semibold text-lg">{expandedSong?.title}</h3>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={previewMode === 'preview' ? 'secondary' : 'ghost'}
                                onClick={() => setPreviewMode('preview')}
                                className="h-8 gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </Button>
                              <Button
                                size="sm"
                                variant={previewMode === 'edit' ? 'secondary' : 'ghost'}
                                onClick={() => setPreviewMode('edit')}
                                className="h-8 gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </Button>
                            </div>
                          </div>
                          
                          {previewMode === 'preview' ? (
                            expandedSong?.lyrics ? (
                              <LyricsDisplay lyrics={expandedSong.lyrics} columns={1} />
                            ) : (
                              <span className="text-zinc-500 italic">No lyrics provided</span>
                            )
                          ) : (
                            <div className="flex flex-col gap-4 flex-1">
                              <Textarea
                                value={editLyrics}
                                onChange={(e) => setEditLyrics(e.target.value)}
                                className="min-h-[300px] font-mono text-sm bg-zinc-950 border-zinc-800"
                                placeholder="Enter lyrics and chords here..."
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setEditLyrics(expandedSong?.lyrics || '');
                                    setPreviewMode('preview');
                                  }}
                                  disabled={savingLyrics}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleSaveLyrics}
                                  disabled={savingLyrics || editLyrics === expandedSong?.lyrics}
                                >
                                  {savingLyrics ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {totalQueuePages > 1 && (
        <div className="pt-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className={`cursor-pointer select-none ${safeQueuePage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                  onClick={() => setQueuePage(Math.max(1, safeQueuePage - 1))}
                />
              </PaginationItem>
              {getPageNumbers(safeQueuePage, totalQueuePages).map((p, idx) =>
                p === 'ellipsis' ? (
                  <PaginationItem key={`e-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      className="cursor-pointer select-none"
                      isActive={p === safeQueuePage}
                      onClick={() => setQueuePage(p)}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  className={`cursor-pointer select-none ${safeQueuePage >= totalQueuePages ? 'pointer-events-none opacity-40' : ''}`}
                  onClick={() => setQueuePage(Math.min(totalQueuePages, safeQueuePage + 1))}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <p className="text-center text-[11px] text-zinc-500 mt-1.5">
            Page {safeQueuePage} of {totalQueuePages} · {pendingSongs.length} pending songs
          </p>
        </div>
      )}

      <RejectSongDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        songTitle={rejectTarget?.title || ''}
        submitting={!!rejectTarget && processingId === rejectTarget.id}
        onConfirm={(payload) => {
          if (rejectTarget) handleVerify(rejectTarget.id, 'rejected', payload);
        }}
      />

      {reportTarget && (
        <ReportSongModal
          open={!!reportTarget}
          onOpenChange={(open) => !open && setReportTarget(null)}
          songId={reportTarget.id}
          songTitle={reportTarget.title}
          allowSpammerFlag
        />
      )}
    </div>
  );
};

export default AdminVerificationQueue;
