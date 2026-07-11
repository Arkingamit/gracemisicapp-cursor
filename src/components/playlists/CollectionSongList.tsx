
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSongs } from '@/contexts/SongContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Song } from '@/lib/types';
import { transposeLyrics, getTransposedKeyName, getKeyDisplayName } from '@/lib/chordUtils';
import { detectKey } from '@/lib/keyDetection';
import { ChevronDown, ChevronRight, Youtube, PlayCircle, RefreshCcw, Trash2, Edit2, PencilOff, Undo2, Redo2, Palette } from 'lucide-react';
import TransposeControls from '@/components/songs/TransposeControls';
import LyricsDisplay from '@/components/songs/LyricsDisplay';
import { SongEditState, CHORD_COLOR_PRESETS, LYRIC_COLOR_PRESETS, nextAnnotationId, cloneEditStates, createEmptyEditState } from '@/lib/songEditTypes';
import { splitIntoSections } from '@/lib/chordParser';

interface CollectionSongListProps {
  songIds: string[];
  collectionName?: string;
  onRemoveSong?: (songId: string) => void;
}

const CollectionSongList = ({ songIds, collectionName, onRemoveSong }: CollectionSongListProps) => {
  const { songs, fetchSongDetails } = useSongs();

  const [searchQuery, setSearchQuery] = useState('');
  const [transposeValues, setTransposeValues] = useState<Record<string, number>>({});
  const [useFlatValues, setUseFlatValues] = useState<Record<string, boolean>>({});
  const [useNumberSystemValues, setUseNumberSystemValues] = useState<Record<string, boolean>>({});
  const [fontSizes, setFontSizes] = useState<Record<string, number>>({});
  const [expandedSongs, setExpandedSongs] = useState<Record<string, boolean>>({});

  // ── Edit State & Undo/Redo ──
  const [editingLayoutFor, setEditingLayoutFor] = useState<Record<string, boolean>>({});
  const [editStates, setEditStates] = useState<Record<string, SongEditState>>({});
  const [history, setHistory] = useState<Record<string, SongEditState>[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showStylePanelFor, setShowStylePanelFor] = useState<string | null>(null);

  // Preserve the order of songIds
  const collectionSongs = songIds
    .map(id => songs.find(song => song.id === id))
    .filter((song): song is Song => !!song);

  const toggleSongExpanded = (songId: string) => {
    setExpandedSongs(prev => ({ ...prev, [songId]: !prev[songId] }));
  };

  const toggleAllExpanded = () => {
    const allExpanded = collectionSongs.every(s => expandedSongs[s.id]);
    const next: Record<string, boolean> = {};
    collectionSongs.forEach(s => { next[s.id] = !allExpanded; });
    setExpandedSongs(next);
  };

  // Lazy load lyrics if missing
  useEffect(() => {
    collectionSongs.forEach(song => {
      if (!song.lyrics) {
        fetchSongDetails(song.id).catch(console.error);
      }
    });
  }, [collectionSongs, fetchSongDetails]);

  const filteredSongs = useMemo(() =>
    collectionSongs.filter(song =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.genre.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [searchQuery, collectionSongs]);

  const songOriginalKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    filteredSongs.forEach(song => {
      if (song.lyrics) {
        keys[song.id] = song.originalKey || detectKey(song.lyrics);
      }
    });
    return keys;
  }, [filteredSongs]);

  const handleTranspose = (songId: string, semitones: number) => {
    setTransposeValues(prev => ({
      ...prev,
      [songId]: ((prev[songId] || 0) + semitones) % 12,
    }));
  };

  const handleResetTranspose = (songId: string) => {
    setTransposeValues(prev => ({ ...prev, [songId]: 0 }));
  };

  const handleUseFlatChange = (songId: string, value: boolean) => {
    setUseFlatValues(prev => ({ ...prev, [songId]: value }));
  };

  const handleUseNumberSystemChange = (songId: string, value: boolean) => {
    setUseNumberSystemValues(prev => ({ ...prev, [songId]: value }));
  };

  const handleFontSizeChange = (songId: string, delta: number) => {
    setFontSizes(prev => ({
      ...prev,
      [songId]: Math.max(10, Math.min(32, (prev[songId] || 16) + delta)),
    }));
  };

  const resetAllTranspositions = () => {
    setTransposeValues({});
    setUseFlatValues({});
    setUseNumberSystemValues({});
  };

  // ── Editor Handlers (Undo/Redo) ──
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
    setEditStates(newStates);
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

  return (
    <div>
      <Card className="rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">Collection Songs</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto mt-4 md:mt-0">
            <Input
              placeholder="Search songs..."
              className="w-full sm:max-w-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="outline" onClick={resetAllTranspositions} className="flex items-center gap-2 shrink-0">
              <RefreshCcw className="h-4 w-4" /> <span className="hidden sm:inline">Reset All</span>
            </Button>
            {filteredSongs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAllExpanded} className="shrink-0">
                {collectionSongs.every(s => expandedSongs[s.id]) ? 'Collapse All' : 'Expand All'}
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
                const transposition = transposeValues[song.id] || 0;
                const useFlats = useFlatValues[song.id] || false;
                const useNumberSystem = useNumberSystemValues[song.id] || false;
                const originalKey = songOriginalKeys[song.id];
                const currentKey = originalKey ? getTransposedKeyName(originalKey, transposition) : 'Unknown';
                const fontSize = fontSizes[song.id] || 16;

                return (
                  <Card
                    key={song.id}
                    className="rounded-lg sm:rounded-xl border-x sm:border-x transition-all duration-150"
                  >
                    <CardHeader
                      className="p-3 sm:px-4 sm:py-3 cursor-pointer select-none"
                      onClick={() => toggleSongExpanded(song.id)}
                    >
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
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
                                <span className="text-xs font-medium">Listen</span>
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
                          <TransposeControls
                            transposition={transposition}
                            currentKey={currentKey}
                            onTransposeUp={() => handleTranspose(song.id, 1)}
                            onTransposeDown={() => handleTranspose(song.id, -1)}
                            onReset={() => handleResetTranspose(song.id)}
                            useNumberSystem={useNumberSystem}
                            onNumberSystemChange={(val) => handleUseNumberSystemChange(song.id, val)}
                          />
                          {/* Edit Layout Toggle */}
                          <Button 
                            variant={editingLayoutFor[song.id] ? "default" : "outline"}
                            size="sm"
                            onClick={() => setEditingLayoutFor(prev => ({ ...prev, [song.id]: !prev[song.id] }))} 
                            className="flex items-center gap-2"
                            title="Edit Layout"
                          >
                            {editingLayoutFor[song.id] ? <PencilOff className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                            <span className="hidden sm:inline">{editingLayoutFor[song.id] ? 'Done' : 'Edit Layout'}</span>
                          </Button>
                          {editingLayoutFor[song.id] && (
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
                          {onRemoveSong && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 gap-1.5"
                              title="Remove from collection"
                              onClick={() => onRemoveSong(song.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Remove</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Style Panel */}
                      {editingLayoutFor[song.id] && showStylePanelFor === song.id && (
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
                          editable={editingLayoutFor[song.id]}
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

export default CollectionSongList;
