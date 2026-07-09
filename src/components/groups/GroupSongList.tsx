import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSongs } from '@/contexts/SongContext';
import { useGroups } from '@/contexts/groups';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/contexts/OrganizationContext';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Song, SongTransposition } from '@/lib/types';
import { transposeLyrics, getTransposedKeyName, getKeyDisplayName } from '@/lib/chordUtils';
import { detectKey } from '@/lib/keyDetection';
import { useToast } from '@/hooks/use-toast';
import { ArrowUpDown, Trash2, RefreshCcw, GripVertical, ChevronDown, ChevronRight, Youtube, PlayCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import TransposeControls from '@/components/songs/TransposeControls';
import LyricsDisplay from '@/components/songs/LyricsDisplay';
import { Palette, Undo2, Redo2, Edit2, PencilOff } from 'lucide-react';
import { SongEditState, CHORD_COLOR_PRESETS, LYRIC_COLOR_PRESETS, nextAnnotationId, cloneEditStates, createEmptyEditState } from '@/lib/songEditTypes';
import { splitIntoSections } from '@/lib/chordParser';

// Debounce helper for transpose sync
const TRANSPOSE_SYNC_DELAY = 1500; // ms

interface GroupSongListProps {
  groupId: string;
  groupSongIds: string[];
  groupName?: string;
}

const GroupSongList = ({ groupId, groupSongIds }: GroupSongListProps) => {
  const { songs, fetchSongDetails } = useSongs();
  const { removeSongFromGroup, getGroup, updateGroup, updateSongTransposition, updateSongEditStates } = useGroups();
  const { getOrganization } = useOrganizations();
  const { currentUser } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [transposeValues, setTransposeValues] = useState<Record<string, number>>({});
  const [useFlatValues, setUseFlatValues] = useState<Record<string, boolean>>({});
  const [useNumberSystemValues, setUseNumberSystemValues] = useState<Record<string, boolean>>({});
  const [fontSizes, setFontSizes] = useState<Record<string, number>>({});

  // ── Edit State & Undo/Redo ──
  const [editingLayoutFor, setEditingLayoutFor] = useState<Record<string, boolean>>({});
  const [editStates, setEditStates] = useState<Record<string, SongEditState>>({});
  const [history, setHistory] = useState<Record<string, SongEditState>[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showStylePanelFor, setShowStylePanelFor] = useState<string | null>(null);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Collapsible state — all songs start collapsed
  const [expandedSongs, setExpandedSongs] = useState<Record<string, boolean>>({});

  const toggleSongExpanded = (songId: string) => {
    setExpandedSongs(prev => ({ ...prev, [songId]: !prev[songId] }));
  };

  const toggleAllExpanded = () => {
    const allExpanded = groupSongs.every(s => expandedSongs[s.id]);
    const next: Record<string, boolean> = {};
    groupSongs.forEach(s => { next[s.id] = !allExpanded; });
    setExpandedSongs(next);
  };

  // Preserve the order of groupSongIds (the order songs were selected/added)
  const groupSongs = groupSongIds
    .map(id => songs.find(song => song.id === id))
    .filter((song): song is Song => !!song);
  const group = getGroup(groupId);

  const canManage = useMemo(() => {
    if (!currentUser || !group) return false;
    const isOwner = group.createdBy === currentUser.id;
    const isSuperAdmin = currentUser.role === 'super_admin';
    
    // Check if user is an editor or manager of the organization that owns this group
    const org = getOrganization(group.organizationId);
    const isOrgEditor = org ? (org.editorIds || []).includes(currentUser.id) : false;
    const isOrgManager = org ? org.managerIds.includes(currentUser.id) : false;
    
    // Only org editors, managers, group creator, or super_admin can manage songs
    return isOwner || isSuperAdmin || isOrgEditor || isOrgManager;
  }, [currentUser, group, getOrganization]);

  const { toast } = useToast();
  
  // Lazy load lyrics if missing
  useEffect(() => {
    groupSongs.forEach(song => {
      if (!song.lyrics) {
        fetchSongDetails(song.id).catch(console.error);
      }
    });
  }, [groupSongs, fetchSongDetails]);

  useEffect(() => {
    if (group?.songTranspositions) {
      const transpositions: Record<string, number> = {};
      const flats: Record<string, boolean> = {};

      group.songTranspositions.forEach(({ songId, transposition, useFlats }) => {
        transpositions[songId] = transposition;
        flats[songId] = useFlats || false;
      });

      // Avoid synchronous setState in effect for Next.js 15 / React 19
      setTimeout(() => {
        setTransposeValues(transpositions);
        setUseFlatValues(flats);
        
        if (group.songEditStates && Object.keys(group.songEditStates).length > 0) {
          setEditStates(group.songEditStates);
        }
      }, 0);
    }
  }, [group]);

  const filteredSongs = useMemo(() =>
    groupSongs.filter(song =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.genre.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [searchQuery, groupSongs]);

  const songOriginalKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    filteredSongs.forEach(song => {
      if (song.lyrics) {
        keys[song.id] = song.originalKey || detectKey(song.lyrics);
      }
    });
    return keys;
  }, [filteredSongs]);

  // Debounce refs for transpose sync
  const transposeSyncTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const debouncedSyncTranspose = useCallback((songId: string, newTranspose: number, newFlats: boolean) => {
    // Clear any pending sync for this song
    if (transposeSyncTimers.current[songId]) {
      clearTimeout(transposeSyncTimers.current[songId]);
    }
    // Schedule a new sync
    transposeSyncTimers.current[songId] = setTimeout(() => {
      updateSongTransposition(groupId, songId, newTranspose, newFlats);
      delete transposeSyncTimers.current[songId];
    }, TRANSPOSE_SYNC_DELAY);
  }, [groupId, updateSongTransposition]);

  const handleTranspose = (songId: string, semitones: number) => {
    const currentTranspose = transposeValues[songId] || 0;
    const newTranspose = currentTranspose + semitones;
    const currentFlats = useFlatValues[songId] || false;
    
    // Instant client-side update
    setTransposeValues(prev => ({ ...prev, [songId]: newTranspose }));
    
    // Debounced server sync
    debouncedSyncTranspose(songId, newTranspose, currentFlats);
  };

  const handleResetTranspose = (songId: string) => {
    const currentFlats = useFlatValues[songId] || false;
    
    // Instant client-side update
    setTransposeValues(prev => ({ ...prev, [songId]: 0 }));
    
    // Debounced server sync
    debouncedSyncTranspose(songId, 0, currentFlats);
  };

  const handleUseFlatChange = (songId: string, value: boolean) => {
    const currentTranspose = transposeValues[songId] || 0;
    
    // Instant client-side update
    setUseFlatValues(prev => ({ ...prev, [songId]: value }));
    
    // Debounced server sync
    debouncedSyncTranspose(songId, currentTranspose, value);
  };

  const handleFontSizeChange = (songId: string, delta: number) => {
    setFontSizes(prev => {
      const currentSize = prev[songId] || 16;
      return { ...prev, [songId]: Math.max(12, currentSize + delta) };
    });
  };

  const handleUseNumberSystemChange = (songId: string, value: boolean) => {
    setUseNumberSystemValues(prev => ({ ...prev, [songId]: value }));
  };


  // Removed saveTranspositionsToGroup as it's replaced by individual updates

  const resetAllTranspositions = async () => {
    setTransposeValues({});
    setUseFlatValues({});
    // Clear all pending sync timers
    Object.values(transposeSyncTimers.current).forEach(clearTimeout);
    transposeSyncTimers.current = {};
    await updateGroup(groupId, { songTranspositions: [] });
  };

  // ── Editor Handlers (Undo/Redo & Save) ──
  const pushHistory = () => {
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(cloneEditStates(editStates));
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIdx >= 0) {
      if (historyIdx === history.length - 1 && history.length > 0) {
        const currentStates = cloneEditStates(editStates);
        const newHistory = [...history, currentStates];
        setHistory(newHistory);
        setEditStates(newHistory[historyIdx]);
        setHistoryIdx(historyIdx);
      } else {
        setEditStates(history[historyIdx]);
        setHistoryIdx(historyIdx - 1);
      }
    }
  };

  const redo = () => {
    if (historyIdx < history.length - 2) {
      const nextIdx = historyIdx + 2;
      setEditStates(history[nextIdx]);
      setHistoryIdx(nextIdx - 1);
    } else if (historyIdx === history.length - 2) {
      setEditStates(history[historyIdx + 1]);
      setHistoryIdx(historyIdx + 1);
    }
  };

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const saveEditStates = (newStates: Record<string, SongEditState>) => {
    setEditStates(newStates);
    if (!canManage) return;
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateSongEditStates(groupId, newStates).catch(console.error);
    }, 1000);
  };

  const updateSongEdit = (songId: string, songObj: Song, updater: (state: SongEditState) => void) => {
    pushHistory();
    const newStates = { ...editStates };
    if (!newStates[songId]) {
      const sections = songObj.lyrics ? splitIntoSections(songObj.lyrics, songObj.format) : [];
      newStates[songId] = createEmptyEditState(sections);
    } else {
      newStates[songId] = cloneEditStates({ [songId]: newStates[songId] })[songId];
    }
    updater(newStates[songId]);
    saveEditStates(newStates);
  };

  // Editing Actions
  const handleChordEdit = (song: Song, sIdx: number, lIdx: number, cIdx: number, newChord: string) => {
    updateSongEdit(song.id, song, state => {
      if (!newChord.trim()) {
        delete state.chordOverrides[`${sIdx}-${lIdx}-${cIdx}`];
      } else {
        state.chordOverrides[`${sIdx}-${lIdx}-${cIdx}`] = newChord.trim();
      }
    });
  };

  const handleLyricEdit = (song: Song, sIdx: number, lIdx: number, newLyric: string) => {
    updateSongEdit(song.id, song, state => {
      state.lyricOverrides[`${sIdx}-${lIdx}`] = newLyric;
    });
  };

  const handleLineChordColorChange = (song: Song, sIdx: number, lIdx: number, cIdx: number, color: string) => {
    updateSongEdit(song.id, song, state => {
      if (!state.chordColorOverrides) state.chordColorOverrides = {};
      if (color) {
        state.chordColorOverrides[`${sIdx}-${lIdx}-${cIdx}`] = color;
      } else {
        delete state.chordColorOverrides[`${sIdx}-${lIdx}-${cIdx}`];
      }
    });
  };

  const handleLineLyricColorChange = (song: Song, sIdx: number, lIdx: number, color: string) => {
    updateSongEdit(song.id, song, state => {
      if (!state.lyricColorOverrides) state.lyricColorOverrides = {};
      if (color) {
        state.lyricColorOverrides[`${sIdx}-${lIdx}`] = color;
      } else {
        delete state.lyricColorOverrides[`${sIdx}-${lIdx}`];
      }
    });
  };

  const handleLabelEdit = (song: Song, sIdx: number, newLabel: string) => {
    updateSongEdit(song.id, song, state => {
      state.labelOverrides[sIdx] = newLabel;
    });
  };

  const handleAddAnnotation = (song: Song, sIdx: number) => {
    updateSongEdit(song.id, song, state => {
      if (!state.annotations[sIdx]) state.annotations[sIdx] = [];
      state.annotations[sIdx].push({ id: nextAnnotationId(), text: '' });
    });
  };

  const handleEditAnnotation = (song: Song, sIdx: number, annId: string, text: string) => {
    updateSongEdit(song.id, song, state => {
      const anns = state.annotations[sIdx] || [];
      const ann = anns.find(a => a.id === annId);
      if (ann) ann.text = text;
    });
  };

  const handleDeleteAnnotation = (song: Song, sIdx: number, annId: string) => {
    updateSongEdit(song.id, song, state => {
      if (state.annotations[sIdx]) {
        state.annotations[sIdx] = state.annotations[sIdx].filter(a => a.id !== annId);
      }
    });
  };

  const handleAnnotationColorChange = (song: Song, sIdx: number, annId: string, color: string) => {
    updateSongEdit(song.id, song, state => {
      const anns = state.annotations[sIdx] || [];
      const ann = anns.find(a => a.id === annId);
      if (ann) ann.color = color;
    });
  };

  const handleSectionToggleHide = (song: Song, sIdx: number) => {
    updateSongEdit(song.id, song, state => {
      if (state.hiddenSections.includes(sIdx)) {
        state.hiddenSections = state.hiddenSections.filter(id => id !== sIdx);
      } else {
        state.hiddenSections.push(sIdx);
      }
    });
  };

  const handleSectionReorder = (song: Song, newOrder: number[]) => {
    updateSongEdit(song.id, song, state => {
      state.sectionOrder = newOrder;
    });
  };

  const handleChordColorChange = (song: Song, color: string) => {
    updateSongEdit(song.id, song, state => {
      state.styles.chordColor = color;
    });
  };

  const handleLyricColorChange = (song: Song, color: string) => {
    updateSongEdit(song.id, song, state => {
      state.styles.lyricColor = color;
    });
  };

  // ── Drag-and-drop handlers ──
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder the IDs array
    const newOrder = [...groupSongIds];
    const [movedId] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, movedId);

    // Persist new order to database
    try {
      await updateGroup(groupId, { songs: newOrder });
    } catch (err) {
      // updateGroup already shows a toast on error
    }

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div>
      <Card className="rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">Song Set Songs</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto mt-4 md:mt-0">
            <Input
              placeholder="Search songs..."
              className="w-full sm:max-w-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="outline" onClick={resetAllTranspositions} className="flex items-center gap-2 shrink-0" disabled={!canManage} title={!canManage ? 'You need editor access to use this' : ''}>
              <RefreshCcw className="h-4 w-4" /> <span className="hidden sm:inline">Reset All</span>
            </Button>
            {filteredSongs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAllExpanded} className="shrink-0">
                {groupSongs.every(s => expandedSongs[s.id]) ? 'Collapse All' : 'Expand All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {filteredSongs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No songs found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSongs.map(song => {
                const realIdx = groupSongs.findIndex(s => s.id === song.id);
                const transposition = transposeValues[song.id] || 0;
                const useFlats = useFlatValues[song.id] || false;
                const useNumberSystem = useNumberSystemValues[song.id] || false;
                const originalKey = songOriginalKeys[song.id];
                const currentKey = originalKey ? getTransposedKeyName(originalKey, transposition) : 'Unknown';
                const fontSize = fontSizes[song.id] || 16;

                return (
                  <Card
                    key={song.id}
                    className={`rounded-lg sm:rounded-xl border-x sm:border-x transition-all duration-150 ${
                      dragIndex === realIdx ? 'opacity-50 scale-[0.98]' : ''
                    } ${dragOverIndex === realIdx && dragIndex !== realIdx ? 'border-t-2 border-primary' : ''}`}
                    draggable={canManage}
                    onDragStart={() => handleDragStart(realIdx)}
                    onDragOver={(e) => handleDragOver(e, realIdx)}
                    onDrop={(e) => handleDrop(e, realIdx)}
                    onDragEnd={handleDragEnd}
                  >
                    <CardHeader
                      className="p-3 sm:px-4 sm:py-3 cursor-pointer select-none"
                      onClick={() => toggleSongExpanded(song.id)}
                    >
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                          {canManage && (
                            <GripVertical
                              className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          {expandedSongs[song.id]
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          }
                          <span className="font-semibold mr-2">
                            {song.title}
                          </span>
                          {song.externalUrl && (() => {
                            const isYoutube = song.externalUrl.toLowerCase().includes('youtube.com') || song.externalUrl.toLowerCase().includes('youtu.be');
                            const Icon = isYoutube ? Youtube : PlayCircle;
                            return (
                              <a
                                href={song.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md"
                                title={isYoutube ? "Watch on YouTube" : "Listen to song"}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="text-xs font-medium">{isYoutube ? "Listen" : "Listen"}</span>
                              </a>
                            );
                          })()}
                        </CardTitle>
                        <div className="text-sm font-medium text-muted-foreground">
                          Key: {getKeyDisplayName(currentKey)}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSongs[song.id] && (
                    <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b pb-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-4">
                              <TransposeControls
                                transposition={transposition}
                                currentKey={currentKey}
                                onTransposeUp={() => handleTranspose(song.id, 1)}
                                onTransposeDown={() => handleTranspose(song.id, -1)}
                                onReset={() => handleResetTranspose(song.id)}
                                useNumberSystem={useNumberSystem}
                                onNumberSystemChange={(val) => handleUseNumberSystemChange(song.id, val)}
                              />
                              <Button 
                                variant={editingLayoutFor[song.id] ? "default" : "outline"}
                                size="sm"
                                onClick={() => canManage && setEditingLayoutFor(prev => ({ ...prev, [song.id]: !prev[song.id] }))} 
                                className="flex items-center gap-2"
                                title={!canManage ? 'You need editor access' : 'Edit Layout'}
                                disabled={!canManage}
                              >
                                {editingLayoutFor[song.id] ? <PencilOff className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                                <span className="hidden sm:inline">{editingLayoutFor[song.id] ? 'Done' : 'Edit Layout'}</span>
                              </Button>
                              {editingLayoutFor[song.id] && canManage && (
                                <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={undo}
                                    disabled={historyIdx < 0}
                                    title="Undo"
                                  >
                                    <Undo2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={redo}
                                    disabled={historyIdx >= history.length - 1}
                                    title="Redo"
                                  >
                                    <Redo2 className="h-4 w-4" />
                                  </Button>
                                  <div className="w-px h-4 bg-border mx-1" />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-2 gap-1.5 ${showStylePanelFor === song.id ? 'bg-primary/10 text-primary' : ''}`}
                                    onClick={() => setShowStylePanelFor(showStylePanelFor === song.id ? null : song.id)}
                                    title="Edit Styles"
                                  >
                                    <Palette className="h-4 w-4" />
                                    <span className="hidden sm:inline">Style</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleFontSizeChange(song.id, 2)}>A+</Button>
                            <Button variant="outline" size="sm" onClick={() => handleFontSizeChange(song.id, -2)}>A-</Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`flat-${song.id}`}
                              checked={useFlats}
                              onCheckedChange={(checked) => handleUseFlatChange(song.id, checked)}
                            />
                            <Label htmlFor={`flat-${song.id}`}>Use flats</Label>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 gap-1.5"
                            title={!canManage ? 'You need editor access to remove songs' : 'Remove'}
                            onClick={() => canManage && removeSongFromGroup(groupId, song.id)}
                            disabled={!canManage}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </Button>
                        </div>
                      </div>

                      {canManage && editingLayoutFor[song.id] && showStylePanelFor === song.id && (
                        <div className="mb-6 bg-secondary/30 border rounded-lg p-3 flex flex-wrap gap-4 items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chords</span>
                            <div className="flex gap-1.5">
                              {CHORD_COLOR_PRESETS.map(preset => (
                                <button
                                  key={preset.value}
                                  className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
                                    (editStates[song.id]?.styles.chordColor || '') === preset.value
                                      ? 'border-white ring-2 ring-offset-2 ring-offset-background ring-primary scale-125'
                                      : 'border-transparent'
                                  }`}
                                  style={{ background: preset.value }}
                                  onClick={() => handleChordColorChange(song, preset.value)}
                                  title={preset.label}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="h-4 w-px bg-border hidden sm:block" />
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lyrics</span>
                            <div className="flex gap-1.5">
                              {LYRIC_COLOR_PRESETS.map(preset => (
                                <button
                                  key={preset.value || 'default'}
                                  className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
                                    (editStates[song.id]?.styles.lyricColor || '') === preset.value
                                      ? 'border-white ring-2 ring-offset-2 ring-offset-background ring-primary scale-125'
                                      : 'border-transparent'
                                  }`}
                                  style={{ background: preset.value || 'hsl(var(--foreground))' }}
                                  onClick={() => handleLyricColorChange(song, preset.value)}
                                  title={preset.label}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {song.lyrics ? (
                        <LyricsDisplay
                          lyrics={song.lyrics}
                          transposition={transposition}
                          useFlats={useFlats}
                          fontSize={fontSize}
                          format={song.format}
                          useNumberSystem={useNumberSystem}
                          currentKey={currentKey}
                          editable={canManage && editingLayoutFor[song.id]}
                          editState={editStates[song.id]}
                          onChordEdit={(sIdx, lIdx, cIdx, newChord) => handleChordEdit(song, sIdx, lIdx, cIdx, newChord)}
                          onLyricEdit={(sIdx, lIdx, newLyric) => handleLyricEdit(song, sIdx, lIdx, newLyric)}
                          onSectionReorder={(newOrder) => handleSectionReorder(song, newOrder)}
                          onSectionToggleHide={(sIdx) => handleSectionToggleHide(song, sIdx)}
                          onLabelEdit={(sIdx, newLabel) => handleLabelEdit(song, sIdx, newLabel)}
                          onAddAnnotation={(sIdx) => handleAddAnnotation(song, sIdx)}
                          onEditAnnotation={(sIdx, annId, text) => handleEditAnnotation(song, sIdx, annId, text)}
                          onAnnotationColorChange={(sIdx, annId, color) => handleAnnotationColorChange(song, sIdx, annId, color)}
                          onDeleteAnnotation={(sIdx, annId) => handleDeleteAnnotation(song, sIdx, annId)}
                          onChordColorChange={(sIdx, lIdx, cIdx, color) => handleLineChordColorChange(song, sIdx, lIdx, cIdx, color)}
                          onLyricColorChange={(sIdx, lIdx, color) => handleLineLyricColorChange(song, sIdx, lIdx, color)}
                        />
                      ) : (
                        <div className="py-4 text-center text-muted-foreground animate-pulse text-sm">
                          Loading lyrics...
                        </div>
                      )}
                    </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupSongList;
