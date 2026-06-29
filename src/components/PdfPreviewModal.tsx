import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

import ChordLyricLine from '@/components/ChordLyricLine';
import EditableSection from '@/components/EditableSection';
import { Song } from '@/lib/types';
import { parseLineWithChords, transposeParsedLine, ParsedLine, SongSection, splitIntoSections } from '@/lib/chordParser';
import { generateSongPdf, PdfExportOptions, PdfOrientation, suggestFontSize } from '@/lib/pdfUtils';
import { useSongs } from '@/contexts/SongContext';
import {
    Download, Eye, Music, Type, ChevronUp, ChevronDown, RotateCcw,
    ListMusic, Lightbulb, Undo2, Redo2, Paintbrush, RotateCw,
    Palette, MousePointerClick, ArrowLeft, ArrowRight, Check,
    MonitorSmartphone, Loader2
} from 'lucide-react';

// ─── Types for Editor State ───

interface Annotation {
    id: string;
    text: string;
    color?: string;
}

interface SongEditState {
    /** chord overrides: key = "sIdx-lIdx-cIdx" */
    chordOverrides: Record<string, string>;
    /** lyric overrides: key = "sIdx-lIdx" */
    lyricOverrides: Record<string, string>;
    /** section label overrides: key = sIdx */
    labelOverrides: Record<number, string>;
    /** section order (indices into the original sections array) */
    sectionOrder: number[];
    /** hidden sections */
    hiddenSections: Set<number>;
    /** annotations per section */
    annotations: Record<number, Annotation[]>;
    /** per-line lyric color overrides */
    lyricColorOverrides: Record<string, string>;
    /** per-chord color overrides */
    chordColorOverrides: Record<string, string>;
    /** style overrides */
    styles: {
        chordColor: string;
        lyricColor: string;
    };
}

interface HistoryEntry {
    editStates: Record<string, SongEditState>;
}

// ─── Color Presets ───

const CHORD_COLOR_PRESETS = [
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Purple', value: '#8b5cf6' },
    { label: 'Emerald', value: '#10b981' },
    { label: 'Rose', value: '#f43f5e' },
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Cyan', value: '#06b6d4' },
    { label: 'Red (Default)', value: '#dc2626' }, // Used as default
];

const LYRIC_COLOR_PRESETS = [
    { label: 'Default', value: '' },
    { label: 'Slate', value: '#334155' },
    { label: 'Zinc', value: '#3f3f46' },
    { label: 'Stone', value: '#44403c' },
    { label: 'Warm', value: '#78350f' },
    { label: 'Cool', value: '#1e3a5f' },
];

// ─── Helpers ───

function createEmptyEditState(sections: SongSection[]): SongEditState {
    return {
        chordOverrides: {},
        lyricOverrides: {},
        labelOverrides: {},
        sectionOrder: sections.map((_, i) => i),
        hiddenSections: new Set(),
        annotations: {},
        lyricColorOverrides: {},
        chordColorOverrides: {},
        styles: { chordColor: '', lyricColor: '' },
    };
}

let annotationIdCounter = 0;
function nextAnnotationId(): string {
    return `ann-${++annotationIdCounter}`;
}

// Deep clone edit state for history
function cloneEditStates(states: Record<string, SongEditState>): Record<string, SongEditState> {
    const result: Record<string, SongEditState> = {};
    for (const [key, state] of Object.entries(states)) {
        result[key] = {
            chordOverrides: { ...state.chordOverrides },
            lyricOverrides: { ...state.lyricOverrides },
            labelOverrides: { ...state.labelOverrides },
            sectionOrder: [...state.sectionOrder],
            hiddenSections: new Set(state.hiddenSections),
            annotations: Object.fromEntries(
                Object.entries(state.annotations).map(([k, v]) => [k, v.map(a => ({ ...a }))])
            ),
            lyricColorOverrides: { ...(state.lyricColorOverrides || {}) },
            chordColorOverrides: { ...(state.chordColorOverrides || {}) },
            styles: { ...state.styles },
        };
    }
    return result;
}

interface PdfPreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    songs: Song[];
    title?: string;
    initialTranspositions?: Record<string, number>;
    initialUseFlats?: Record<string, boolean>;
    initialFontSize?: number;
    /** Pre-populate edit states from the Song Set editor (stored as JSON with hiddenSections as number[]) */
    initialEditStates?: Record<string, any>;
}

/* ─────────────────────────────────────────
   Mobile step flow:
   Step 0 – Song list + font size slider
   Step 1 – Per-song controls (transpose, flats, section chords)
   Step 2 – Live preview canvas
   ───────────────────────────────────────── */

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
    open,
    onOpenChange,
    songs,
    title,
    initialTranspositions = {},
    initialUseFlats = {},
    initialFontSize = 22,
    initialEditStates = {},
}) => {
    // ─── Global settings ───
    const [fontSize, setFontSize] = useState(initialFontSize);
    const [selectedSongId, setSelectedSongId] = useState<string>('');
    const [orientation, setOrientation] = useState<PdfOrientation>('landscape');
    const [useNumberSystem, setUseNumberSystem] = useState(false);

    // Mobile step tracker (0 = song list, 1 = per-song controls, 2 = preview)
    const [mobileStep, setMobileStep] = useState(0);
    const [isExporting, setIsExporting] = useState(false);

    // ─── Per-song settings ───
    const [transpositions, setTranspositions] = useState<Record<string, number>>({});
    const [useFlatsMap, setUseFlatsMap] = useState<Record<string, boolean>>({});
    const [perSongFontSize, setPerSongFontSize] = useState<Record<string, number | null>>({});
    const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean[]>>({});

    // ─── Per-song edit state (NEW — Canva editing) ───
    const [editStates, setEditStates] = useState<Record<string, SongEditState>>({});

    // ─── Undo/Redo history ───
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);

    // ─── Drag state ───
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

    // ─── Style panel open ───
    const [showStylePanel, setShowStylePanel] = useState(false);
    const [mobileShowStylePanel, setMobileShowStylePanel] = useState(false);

    // Parse sections
    const allSectionsMap = useMemo(() => {
        const map: Record<string, SongSection[]> = {};
        songs.forEach(s => {
            map[s.id] = s.lyrics ? splitIntoSections(s.lyrics, s.format) : [];
        });
        return map;
    }, [songs]);

    const { fetchSongDetails } = useSongs();
    const [loadingLyrics, setLoadingLyrics] = useState(false);

    // Fetch missing lyrics
    useEffect(() => {
        if (open && songs.some(s => !s.lyrics)) {
            setLoadingLyrics(true);
            Promise.all(songs.filter(s => !s.lyrics).map(s => fetchSongDetails(s.id)))
                .finally(() => setLoadingLyrics(false));
        }
    }, [open, songs, fetchSongDetails]);

    // Initialize state when modal opens
    useEffect(() => {
        if (open && songs.length > 0) {
            if (!selectedSongId || !songs.find(s => s.id === selectedSongId)) {
                setSelectedSongId(songs[0].id);
            }

            const newVis: Record<string, boolean[]> = {};
            const newTrans: Record<string, number> = { ...initialTranspositions };
            const newFlats: Record<string, boolean> = { ...initialUseFlats };
            const newEdits: Record<string, SongEditState> = {};
            const newPerSongFs: Record<string, number | null> = {};

            songs.forEach(song => {
                const sections = allSectionsMap[song.id];
                newVis[song.id] = sections.map(() => true);
                if (newTrans[song.id] === undefined) newTrans[song.id] = 0;
                if (newFlats[song.id] === undefined) newFlats[song.id] = false;
                // Use saved edit state from Song Set if available, otherwise create empty
                if (initialEditStates[song.id]) {
                    const saved = initialEditStates[song.id];
                    newEdits[song.id] = {
                        chordOverrides: { ...(saved.chordOverrides || {}) },
                        lyricOverrides: { ...(saved.lyricOverrides || {}) },
                        labelOverrides: { ...(saved.labelOverrides || {}) },
                        sectionOrder: saved.sectionOrder?.length === sections.length
                            ? [...saved.sectionOrder]
                            : sections.map((_, i) => i),
                        hiddenSections: new Set(Array.isArray(saved.hiddenSections) ? saved.hiddenSections : []),
                        annotations: saved.annotations
                            ? Object.fromEntries(
                                Object.entries(saved.annotations).map(([k, v]) => [k, (v as Annotation[]).map(a => ({ ...a }))])
                              )
                            : {},
                        lyricColorOverrides: { ...(saved.lyricColorOverrides || {}) },
                        chordColorOverrides: { ...(saved.chordColorOverrides || {}) },
                        styles: {
                            chordColor: saved.styles?.chordColor || '',
                            lyricColor: saved.styles?.lyricColor || '',
                        },
                    };
                } else {
                    newEdits[song.id] = createEmptyEditState(sections);
                }
                newPerSongFs[song.id] = null; // default: use global
            });

            setSectionVisibility(newVis);
            setTranspositions(newTrans);
            setUseFlatsMap(newFlats);
            setEditStates(newEdits);
            setPerSongFontSize(newPerSongFs);
            setHistory([]);
            setHistoryIdx(-1);
            setMobileStep(0); // reset to step 0 on open
        }
    }, [open, songs, allSectionsMap]);

    if (!open || songs.length === 0 || !selectedSongId) return null;

    if (loadingLyrics) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md p-10 flex flex-col items-center justify-center">
                    <DialogTitle className="sr-only">Loading Preview</DialogTitle>
                    <p className="animate-pulse text-muted-foreground">Loading song lyrics...</p>
                </DialogContent>
            </Dialog>
        );
    }

    const currentSong = songs.find(s => s.id === selectedSongId)!;
    const currentSections = allSectionsMap[currentSong.id] || [];
    const currentVisibility = sectionVisibility[currentSong.id] || [];
    const currentTransposition = transpositions[currentSong.id] || 0;
    const currentUseFlats = useFlatsMap[currentSong.id] || false;
    const currentEdit = editStates[currentSong.id] || createEmptyEditState(currentSections);
    const currentPerSongFs = perSongFontSize[currentSong.id];
    const effectiveFontSize = currentPerSongFs ?? fontSize; // per-song overrides global

    // ─── Push state to undo history ───
    const pushHistory = () => {
        const entry: HistoryEntry = { editStates: cloneEditStates(editStates) };
        const newHistory = history.slice(0, historyIdx + 1);
        newHistory.push(entry);
        if (newHistory.length > 50) newHistory.shift(); // cap at 50
        setHistory(newHistory);
        setHistoryIdx(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIdx < 0) return;
        const entry = history[historyIdx];
        setEditStates(cloneEditStates(entry.editStates));
        setHistoryIdx(historyIdx - 1);
    };

    const redo = () => {
        if (historyIdx >= history.length - 1) return;
        const nextIdx = historyIdx + 1;
        setEditStates(cloneEditStates(history[nextIdx].editStates));
        setHistoryIdx(nextIdx);
    };

    // ─── Edit state updaters ───

    const updateCurrentEdit = (updater: (prev: SongEditState) => SongEditState) => {
        pushHistory();
        setEditStates(prev => ({
            ...prev,
            [currentSong.id]: updater(prev[currentSong.id] || createEmptyEditState(currentSections)),
        }));
    };

    // Chord edit
    const handleChordEdit = (sIdx: number, lIdx: number, cIdx: number, newChord: string) => {
        updateCurrentEdit(prev => ({
            ...prev,
            chordOverrides: { ...prev.chordOverrides, [`${sIdx}-${lIdx}-${cIdx}`]: newChord },
        }));
    };

    // Lyric edit
    const handleLyricEdit = (sIdx: number, lIdx: number, newLyrics: string) => {
        updateCurrentEdit(prev => ({
            ...prev,
            lyricOverrides: { ...prev.lyricOverrides, [`${sIdx}-${lIdx}`]: newLyrics },
        }));
    };

    // Chord color edit
    const handleLineChordColorChange = (sIdx: number, lIdx: number, cIdx: number, color: string) => {
        updateCurrentEdit(prev => {
            const chordColorOverrides = { ...(prev.chordColorOverrides || {}) };
            if (color) {
                chordColorOverrides[`${sIdx}-${lIdx}-${cIdx}`] = color;
            } else {
                delete chordColorOverrides[`${sIdx}-${lIdx}-${cIdx}`];
            }
            return { ...prev, chordColorOverrides };
        });
    };

    // Lyric color edit
    const handleLineLyricColorChange = (sIdx: number, lIdx: number, color: string) => {
        updateCurrentEdit(prev => {
            const lyricColorOverrides = { ...(prev.lyricColorOverrides || {}) };
            if (color) {
                lyricColorOverrides[`${sIdx}-${lIdx}`] = color;
            } else {
                delete lyricColorOverrides[`${sIdx}-${lIdx}`];
            }
            return { ...prev, lyricColorOverrides };
        });
    };

    // Section label edit
    const handleLabelEdit = (sIdx: number, newLabel: string) => {
        updateCurrentEdit(prev => ({
            ...prev,
            labelOverrides: { ...prev.labelOverrides, [sIdx]: newLabel },
        }));
    };

    // Section hide/show
    const handleToggleHide = (sIdx: number) => {
        updateCurrentEdit(prev => {
            const next = new Set(prev.hiddenSections);
            if (next.has(sIdx)) next.delete(sIdx);
            else next.add(sIdx);
            return { ...prev, hiddenSections: next };
        });
    };

    // Annotations
    const handleAddAnnotation = (sIdx: number) => {
        updateCurrentEdit(prev => {
            const existing = prev.annotations[sIdx] || [];
            return {
                ...prev,
                annotations: {
                    ...prev.annotations,
                    [sIdx]: [...existing, { id: nextAnnotationId(), text: '' }],
                },
            };
        });
    };

    const handleEditAnnotation = (sIdx: number, annId: string, text: string) => {
        setEditStates(prev => {
            const songEdit = prev[currentSong.id];
            if (!songEdit) return prev;
            const existing = songEdit.annotations[sIdx] || [];
            return {
                ...prev,
                [currentSong.id]: {
                    ...songEdit,
                    annotations: {
                        ...songEdit.annotations,
                        [sIdx]: existing.map(a => a.id === annId ? { ...a, text } : a),
                    },
                },
            };
        });
    };

    const handleDeleteAnnotation = (sIdx: number, annId: string) => {
        updateCurrentEdit(prev => ({
            ...prev,
            annotations: {
                ...prev.annotations,
                [sIdx]: (prev.annotations[sIdx] || []).filter(a => a.id !== annId),
            },
        }));
    };

    const handleAnnotationColorChange = (sIdx: number, annId: string, color: string) => {
        updateCurrentEdit(prev => {
            const existing = prev.annotations[sIdx] || [];
            return {
                ...prev,
                annotations: {
                    ...prev.annotations,
                    [sIdx]: existing.map(a => a.id === annId ? { ...a, color } : a),
                },
            };
        });
    };

    // Style changes
    const handleChordColorChange = (color: string) => {
        updateCurrentEdit(prev => ({
            ...prev,
            styles: { ...prev.styles, chordColor: color },
        }));
    };

    const handleLyricColorChange = (color: string) => {
        updateCurrentEdit(prev => ({
            ...prev,
            styles: { ...prev.styles, lyricColor: color },
        }));
    };

    // ─── Drag and Drop ───
    const handleDragStart = (e: React.DragEvent, idx: number) => {
        setDragIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetIdx(idx);
    };

    const handleDragEnd = () => {
        if (dragIdx !== null && dropTargetIdx !== null && dragIdx !== dropTargetIdx) {
            updateCurrentEdit(prev => {
                const newOrder = [...prev.sectionOrder];
                const [moved] = newOrder.splice(dragIdx, 1);
                newOrder.splice(dropTargetIdx, 0, moved);
                return { ...prev, sectionOrder: newOrder };
            });
        }
        setDragIdx(null);
        setDropTargetIdx(null);
    };

    // ─── Reset all edits ───
    const resetAllEdits = () => {
        pushHistory();
        setEditStates(prev => ({
            ...prev,
            [currentSong.id]: createEmptyEditState(currentSections),
        }));
    };

    // ─── Existing controls ───

    const toggleSectionChords = (index: number) => {
        setSectionVisibility(prev => ({
            ...prev,
            [currentSong.id]: prev[currentSong.id].map((v, i) => i === index ? !v : v)
        }));
    };

    const setAllChords = (on: boolean) => {
        setSectionVisibility(prev => ({
            ...prev,
            [currentSong.id]: prev[currentSong.id].map(() => on)
        }));
    };

    const updateTransposition = (val: number | ((prev: number) => number)) => {
        setTranspositions(prev => {
            const next = typeof val === 'function' ? val(prev[currentSong.id] || 0) : val;
            return { ...prev, [currentSong.id]: Math.max(-11, Math.min(11, next)) };
        });
    };

    const updateUseFlats = (val: boolean) => {
        setUseFlatsMap(prev => ({ ...prev, [currentSong.id]: val }));
    };

    const allChordsOn = currentVisibility.every(Boolean);
    const allChordsOff = currentVisibility.every(v => !v);

    // ─── Build preview sections in displayed order ───

    const orderedSectionIndices = currentEdit.sectionOrder.length === currentSections.length
        ? currentEdit.sectionOrder
        : currentSections.map((_, i) => i);

    const processedCurrentSections = orderedSectionIndices.map((origIdx) => {
        const section = currentSections[origIdx];
        if (!section) return { lines: [] as ParsedLine[], origIdx, label: `Section ${origIdx + 1}` };

        const showChords = currentVisibility[origIdx] ?? true;
        const lines = section.lines.map((line, lIdx) => {
            const parsed = parseLineWithChords(line);
            const transposed = transposeParsedLine(parsed, currentTransposition, currentUseFlats);

            // Apply chord overrides
            const overriddenChords = transposed.chords.map((cp, cIdx) => {
                const key = `${origIdx}-${lIdx}-${cIdx}`;
                const override = currentEdit.chordOverrides[key];
                return override ? { ...cp, chord: override } : cp;
            });

            // Apply lyric override
            const lyricKey = `${origIdx}-${lIdx}`;
            const lyricOverride = currentEdit.lyricOverrides[lyricKey];

            const finalLine: ParsedLine = {
                lyrics: lyricOverride ?? transposed.lyrics,
                chords: showChords ? overriddenChords : [],
            };
            return finalLine;
        });

        const label = currentEdit.labelOverrides[origIdx] ?? section.label;
        return { lines, origIdx, label };
    });

    // Check if any edits exist for the current song
    const hasEdits = currentEdit && (
        Object.keys(currentEdit.chordOverrides).length > 0 ||
        Object.keys(currentEdit.lyricOverrides).length > 0 ||
        Object.keys(currentEdit.labelOverrides).length > 0 ||
        currentEdit.hiddenSections.size > 0 ||
        Object.values(currentEdit.annotations).some(a => a.length > 0) ||
        currentEdit.styles.chordColor !== '' ||
        currentEdit.styles.lyricColor !== ''
    );

    // ─── Export ───

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const modifiedSongs = songs.map(song => {
                const sections = allSectionsMap[song.id];
                const visibilities = sectionVisibility[song.id] || sections.map(() => true);
                const songEdit = editStates[song.id] || createEmptyEditState(sections);

                const order = songEdit.sectionOrder.length === sections.length
                    ? songEdit.sectionOrder
                    : sections.map((_, i) => i);

                const modifiedLyrics = order
                    .filter(idx => !songEdit.hiddenSections.has(idx))
                    .map((origIdx) => {
                        const section = sections[origIdx];
                        const showChords = visibilities[origIdx];
                        const label = songEdit.labelOverrides[origIdx] ?? section.label;

                        // Build annotation text
                        const anns = (songEdit.annotations[origIdx] || [])
                            .filter(a => a.text.trim())
                            .map(a => `(${a.text})`)
                            .join(' ');

                        const sectionLines = section.lines.map((line, lIdx) => {
                            // Apply lyric override
                            const lyricKey = `${origIdx}-${lIdx}`;
                            const hasLyricOverride = songEdit.lyricOverrides[lyricKey] !== undefined;
                            let processedLine = hasLyricOverride
                                ? songEdit.lyricOverrides[lyricKey]
                                : line;

                            // Apply chord overrides by rebuilding the line
                            if (showChords) {
                                const parsed = parseLineWithChords(line);
                                let hasChordEdits = false;
                                const newChords = parsed.chords.map((cp, cIdx) => {
                                    const key = `${origIdx}-${lIdx}-${cIdx}`;
                                    const override = songEdit.chordOverrides[key];
                                    if (override) hasChordEdits = true;
                                    return override ? { ...cp, chord: override } : cp;
                                });

                                if (hasChordEdits || hasLyricOverride) {
                                    // Rebuild the ChordPro line with chords inserted into the (possibly overridden) lyrics
                                    let result = '';
                                    let lastPos = 0;
                                    const plainLyrics = songEdit.lyricOverrides[lyricKey] ?? parsed.lyrics;

                                    newChords.forEach((cp) => {
                                        result += plainLyrics.substring(lastPos, cp.position);
                                        result += `[${cp.chord}]`;
                                        lastPos = cp.position;
                                    });
                                    result += plainLyrics.substring(lastPos);
                                    processedLine = result;
                                }
                            }

                            if (!showChords) {
                                processedLine = processedLine.replace(/\[([^\]]+)\]/g, '');
                            }

                            return processedLine;
                        });

                        // Prepend annotation if any
                        const annotationLine = anns ? `${anns}\n` : '';
                        // Only include explicit labels (Verse, Chorus, etc.) — skip auto-generated "Section N"
                        // Output WITHOUT [brackets] to avoid being treated as chords by transposeLyrics
                        const isAutoLabel = /^Section \d+$/i.test(label);
                        const labelLine = isAutoLabel ? '' : `${label}\n`;
                        return annotationLine + labelLine + sectionLines.join('\n');
                    }).join('\n\n');

                return {
                    ...song,
                    lyrics: modifiedLyrics,
                    transposition: transpositions[song.id] || 0,
                    useFlats: useFlatsMap[song.id] || false,
                    perSongFontSize: perSongFontSize[song.id] ?? undefined,
                };
            });

            const pdfOptions: PdfExportOptions = {
                showChords: true,
                fontSize,
                orientation,
                editOverrides: songs.reduce((acc, song) => {
                    const songEdit = editStates[song.id];
                    if (songEdit) {
                        acc[song.id] = {
                            chordColor: songEdit.styles.chordColor,
                            lyricColor: songEdit.styles.lyricColor,
                        };
                    }
                    return acc;
                }, {} as Record<string, { chordColor: string; lyricColor: string }>),
                useNumberSystem,
            };

            await generateSongPdf(modifiedSongs, pdfOptions, title || (songs.length === 1 ? songs[0].title : 'Song Set'));
        } finally {
            setIsExporting(false);
        }
    };

    // Handle song click on mobile – select and go to step 1
    const handleMobileSongClick = (songId: string) => {
        setSelectedSongId(songId);
        setMobileStep(1);
    };

    // Step labels for the progress bar
    const stepLabels = ['Songs', 'Settings', 'Preview'];

    /* ═══════════════════════════════════════
       Mobile Step Progress Indicator
       ═══════════════════════════════════════ */
    const MobileStepIndicator = () => (
        <div className="flex items-center gap-1 mb-4 md:hidden">
            {stepLabels.map((label, i) => (
                <React.Fragment key={label}>
                    <button
                        onClick={() => setMobileStep(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mobileStep === i
                                ? 'bg-purple-600 text-white shadow-md'
                                : mobileStep > i
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                    : 'bg-secondary text-muted-foreground'
                            }`}
                    >
                        {mobileStep > i ? <Check className="h-3 w-3" /> : <span className="w-4 text-center">{i + 1}</span>}
                        {label}
                    </button>
                    {i < stepLabels.length - 1 && (
                        <div className={`flex-1 h-0.5 rounded-full transition-colors ${mobileStep > i ? 'bg-purple-400' : 'bg-secondary'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    /* ═══════════════════════════════════════
       Mobile Step 0: Song List + Font Size
       ═══════════════════════════════════════ */
    const MobileStep0 = () => (
        <div className="flex flex-col gap-4 md:hidden overflow-y-auto flex-1">
            {/* Font Size Controls */}
            <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                <Label className="text-sm font-semibold flex items-center gap-1">
                    <Type className="h-4 w-4" /> Font Size (All Songs)
                </Label>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setFontSize(prev => Math.max(8, prev - 1))}
                        disabled={fontSize <= 8}
                    >
                        <span className="text-lg font-bold">−</span>
                    </Button>
                    <div className="flex-1 text-center">
                        <span className="text-2xl font-bold">{fontSize}</span>
                        <span className="text-xs text-muted-foreground ml-1">px</span>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setFontSize(prev => Math.min(24, prev + 1))}
                        disabled={fontSize >= 24}
                    >
                        <span className="text-lg font-bold">+</span>
                    </Button>
                </div>
                {/* Visual bar indicator */}
                <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                    <div
                        className="bg-primary rounded-full h-1.5 transition-all duration-200"
                        style={{ width: `${((fontSize - 8) / 16) * 100}%` }}
                    />
                </div>
                <div className="text-[10px] text-muted-foreground text-center">
                    {orientation === 'portrait'
                        ? (fontSize >= 14 ? '1 column' : fontSize >= 10 ? '2 columns' : '3 columns')
                        : (fontSize <= 10 ? '4 columns' : fontSize <= 13 ? '3 columns' : '2 columns')}
                </div>
            </div>

            {/* Orientation Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <Label className="text-sm font-semibold flex items-center gap-1">
                    <MonitorSmartphone className="h-4 w-4" /> Page Orientation
                </Label>
                <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
                    <button
                        onClick={() => setOrientation('landscape')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${orientation === 'landscape'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Landscape
                    </button>
                    <button
                        onClick={() => setOrientation('portrait')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${orientation === 'portrait'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Portrait
                    </button>
                </div>
            </div>

            {/* Number System Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <Label htmlFor="mobile-number-system" className="text-sm font-semibold flex items-center gap-1">
                    <Music className="h-4 w-4" /> Number System (All)
                </Label>
                <Switch id="mobile-number-system" checked={useNumberSystem} onCheckedChange={setUseNumberSystem} />
            </div>

            {/* Song List */}
            <div className="space-y-1">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-muted-foreground">
                    <ListMusic className="h-4 w-4" /> Tap a song to configure
                </h3>
                {songs.map((song, i) => (
                    <button
                        key={song.id}
                        onClick={() => handleMobileSongClick(song.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all active:scale-[0.98] ${selectedSongId === song.id
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100 font-medium ring-1 ring-purple-300 dark:ring-purple-700'
                                : 'bg-secondary/30 hover:bg-secondary text-foreground'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">
                                {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-sm">{song.title}</div>
                                <div className="truncate text-xs text-muted-foreground">{song.artist} • {song.genre.join(', ')}</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════
       Mobile Step 1: Per-Song Controls
       ═══════════════════════════════════════ */
    const MobileStep1 = () => (
        <div className="flex flex-col gap-4 md:hidden overflow-y-auto flex-1">
            {/* Song header */}
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-100 rounded-lg">
                <p className="text-xs uppercase tracking-wider font-bold opacity-70 mb-1">Settings for:</p>
                <p className="font-semibold">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground">{currentSong.artist}</p>
            </div>

            {/* Per-song Font Size */}
            <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-1">
                        <Type className="h-4 w-4" /> Font Size (this song)
                    </Label>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            {currentPerSongFs !== null ? `${currentPerSongFs}px` : `Global (${fontSize}px)`}
                        </span>
                        <Switch
                            checked={currentPerSongFs !== null}
                            onCheckedChange={(on) => {
                                setPerSongFontSize(prev => ({
                                    ...prev,
                                    [currentSong.id]: on ? fontSize : null,
                                }));
                            }}
                        />
                    </div>
                </div>
                {currentPerSongFs !== null && (
                    <>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => setPerSongFontSize(prev => ({ ...prev, [currentSong.id]: Math.max(8, (currentPerSongFs ?? fontSize) - 1) }))}
                                disabled={currentPerSongFs <= 8}
                            >
                                <span className="text-lg font-bold">−</span>
                            </Button>
                            <div className="flex-1 text-center">
                                <span className="text-2xl font-bold">{currentPerSongFs}</span>
                                <span className="text-xs text-muted-foreground ml-1">px</span>
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => setPerSongFontSize(prev => ({ ...prev, [currentSong.id]: Math.min(24, (currentPerSongFs ?? fontSize) + 1) }))}
                                disabled={currentPerSongFs >= 24}
                            >
                                <span className="text-lg font-bold">+</span>
                            </Button>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                            <div
                                className="bg-primary rounded-full h-1.5 transition-all duration-200"
                                style={{ width: `${((currentPerSongFs - 8) / 16) * 100}%` }}
                            />
                        </div>
                    </>
                )}
                {/* Font size suggestion */}
                {(() => {
                    const effFs = currentPerSongFs ?? fontSize;
                    // Build effective lyrics: strip chord markers from sections with chords hidden
                    const effectiveLyrics = currentSections.map((section, idx) => {
                        const hasChordsVisible = currentVisibility[idx] ?? true;
                        const lines = section.lines.map(line =>
                            hasChordsVisible ? line : line.replace(/\[([^\]]+)\]/g, '')
                        );
                        return lines.join('\n');
                    }).join('\n\n');
                    const anyChordVisible = currentVisibility.some(v => v);
                    const currentSuggested = suggestFontSize(effectiveLyrics, anyChordVisible, 8, 24, orientation);
                    return currentSuggested < effFs ? (
                        <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
                            <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                    Use {currentSuggested}px to fit on 1 page
                                </p>
                                <Button
                                    size="sm" variant="outline"
                                    className="mt-1 h-5 text-[10px] px-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => setPerSongFontSize(prev => ({ ...prev, [currentSong.id]: currentSuggested }))}
                                >
                                    Apply {currentSuggested}px for this song
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-2 rounded-md bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                            <span className="text-green-500 text-xs">✓</span>
                            <p className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                                Fits on 1 page at {effFs}px
                            </p>
                        </div>
                    );
                })()}
            </div>

            {/* Transpose */}
            <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                <Label className="text-sm font-semibold flex items-center gap-1">
                    <Music className="h-4 w-4" /> Transpose
                </Label>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateTransposition(t => t - 1)}>
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-mono w-8 text-center">{currentTransposition >= 0 ? '+' : ''}{currentTransposition}</span>
                    <Button size="sm" variant="outline" onClick={() => updateTransposition(t => t + 1)}>
                        <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateTransposition(0)}>
                        <RotateCcw className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            {/* Use Flats / Sharps */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <Label htmlFor="mobile-flats" className="text-sm font-semibold">Use Flats (♭) instead of Sharps (♯)</Label>
                <Switch id="mobile-flats" checked={currentUseFlats} onCheckedChange={updateUseFlats} />
            </div>

            {/* Section Chord Controls */}
            <div className="space-y-2 p-3 rounded-lg border bg-card shadow-sm">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Section Chords</Label>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant={allChordsOn ? 'default' : 'outline'}
                            className="h-6 text-[10px] px-2"
                            onClick={() => setAllChords(true)}
                        >
                            All On
                        </Button>
                        <Button
                            size="sm"
                            variant={allChordsOff ? 'default' : 'outline'}
                            className="h-6 text-[10px] px-2"
                            onClick={() => setAllChords(false)}
                        >
                            All Off
                        </Button>
                    </div>
                </div>
                <div className="space-y-1 mt-2">
                    {currentSections.map((section, i) => (
                        <div
                            key={i}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-secondary transition-colors ${currentVisibility[i] ? 'bg-secondary/40' : ''
                                }`}
                            onClick={() => toggleSectionChords(i)}
                        >
                            <Checkbox
                                checked={currentVisibility[i]}
                                onCheckedChange={() => toggleSectionChords(i)}
                                className="pointer-events-none"
                            />
                            <span className="text-xs font-medium flex-1">{section.label}</span>
                            {section.hasChords && (
                                <Music className="h-3 w-3 text-blue-500" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    /* ═══════════════════════════════════════
       Mobile Step 2: Preview Canvas
       ═══════════════════════════════════════ */

    const MobileStep2 = () => (
        <div className="flex flex-col md:hidden overflow-y-auto flex-1 border rounded-lg bg-white dark:bg-transparent shadow-inner">
            {/* ── Mobile Editor Toolbar ── */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-transparent/95 backdrop-blur-sm border-b px-3 py-2 space-y-2">
                <div className="flex items-center gap-1 flex-wrap">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
                        <MousePointerClick className="h-3 w-3" />
                        <span>Tap to edit</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={undo}
                        disabled={historyIdx < 0}
                        title="Undo"
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={redo}
                        disabled={historyIdx >= history.length - 1}
                        title="Redo"
                    >
                        <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => setMobileShowStylePanel(!mobileShowStylePanel)}
                    >
                        <Palette className="h-3.5 w-3.5" />
                        Colors
                    </Button>
                    {hasEdits && (
                        <>
                            <div className="h-4 w-px bg-border" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-500 hover:text-red-600 gap-1"
                                onClick={resetAllEdits}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </Button>
                        </>
                    )}
                </div>

                {/* ── Mobile Color Picker Panel ── */}
                {mobileShowStylePanel && (
                    <div className="flex flex-wrap gap-3 py-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chords</span>
                            <div className="flex gap-1">
                                {CHORD_COLOR_PRESETS.map(preset => (
                                    <button
                                        key={preset.value}
                                        className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${currentEdit.styles.chordColor === preset.value
                                                ? 'border-white ring-2 ring-offset-2 ring-offset-background ring-primary scale-125'
                                                : 'border-transparent'
                                            }`}
                                        style={{ background: preset.value || '#3b82f6' }}
                                        onClick={() => handleChordColorChange(preset.value)}
                                        title={preset.label}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lyrics</span>
                            <div className="flex gap-1">
                                {LYRIC_COLOR_PRESETS.map(preset => (
                                    <button
                                        key={preset.value || 'default'}
                                        className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${currentEdit.styles.lyricColor === preset.value
                                                ? 'border-white ring-2 ring-offset-2 ring-offset-background ring-primary scale-125'
                                                : 'border-transparent'
                                            }`}
                                        style={{ background: preset.value || 'hsl(var(--foreground))' }}
                                        onClick={() => handleLyricColorChange(preset.value)}
                                        title={preset.label}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Song header */}
            <div className="mb-4 pb-3 border-b px-4 pt-3">
                <h2 className="text-xl font-bold text-foreground">{currentSong.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">by {currentSong.artist} • {currentSong.genre.join(', ')}</p>
                {songs.length > 1 && (
                    <div className="mt-2 inline-block px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full font-medium">
                        Song {songs.findIndex(s => s.id === selectedSongId) + 1} of {songs.length}
                    </div>
                )}
            </div>

            {/* Rendered sections — editable canvas */}
            <div className="space-y-6 px-4 pb-4">
                {processedCurrentSections.map((sectionData, displayIdx) => {
                    const { lines, origIdx, label } = sectionData;
                    const isHidden = currentEdit.hiddenSections.has(origIdx);
                    const annotations = currentEdit.annotations[origIdx] || [];

                    return (
                        <EditableSection
                            key={`mobile-${origIdx}-${displayIdx}`}
                            sectionIndex={displayIdx}
                            label={label}
                            annotations={annotations}
                            hidden={isHidden}
                            onLabelEdit={(newLabel) => handleLabelEdit(origIdx, newLabel)}
                            onAddAnnotation={() => handleAddAnnotation(origIdx)}
                            onEditAnnotation={(annId, text) => handleEditAnnotation(origIdx, annId, text)}
                            onAnnotationColorChange={(annId, color) => handleAnnotationColorChange(origIdx, annId, color)}
                            onDeleteAnnotation={(annId) => handleDeleteAnnotation(origIdx, annId)}
                            onToggleHide={() => handleToggleHide(origIdx)}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            isDragging={dragIdx === displayIdx}
                            isDropTarget={dropTargetIdx === displayIdx}
                        >
                            {!isHidden && lines.map((parsedLine, lIdx) => (
                                <ChordLyricLine
                                    key={`mobile-${origIdx}-${lIdx}`}
                                    parsedLine={parsedLine}
                                    fontSize={effectiveFontSize}
                                    editable={true}
                                    chordColor={currentEdit.styles.chordColor || undefined}
                                    lyricColor={currentEdit.styles.lyricColor || undefined}
                                    lineLyricColor={currentEdit.lyricColorOverrides?.[`${origIdx}-${lIdx}`] || undefined}
                                    perChordColors={
                                        parsedLine.chords.length > 0
                                            ? Object.fromEntries(
                                                parsedLine.chords.map((_: any, cIdx: number) => {
                                                    const color = currentEdit.chordColorOverrides?.[`${origIdx}-${lIdx}-${cIdx}`];
                                                    return color ? [cIdx, color] : null;
                                                }).filter(Boolean) as [number, string][]
                                            )
                                            : {}
                                    }
                                    onChordEdit={(cIdx, newChord) => handleChordEdit(origIdx, lIdx, cIdx, newChord)}
                                    onLyricEdit={(newLyrics) => handleLyricEdit(origIdx, lIdx, newLyrics)}
                                    onChordColorChange={(cIdx, color) => handleLineChordColorChange(origIdx, lIdx, cIdx, color)}
                                    onLyricColorChange={(color) => handleLineLyricColorChange(origIdx, lIdx, color)}
                                />
                            ))}
                            {isHidden && (
                                <p className="text-xs italic text-muted-foreground py-2">Section hidden from export</p>
                            )}
                        </EditableSection>
                    );
                })}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════
       Mobile Navigation Buttons
       ═══════════════════════════════════════ */
    const MobileNavButtons = () => (
        <div className="flex gap-2 md:hidden mt-3">
            {mobileStep > 0 && (
                <Button
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => setMobileStep(mobileStep - 1)}
                >
                    <ArrowLeft className="h-4 w-4" />
                    {stepLabels[mobileStep - 1]}
                </Button>
            )}
            {mobileStep < 2 ? (
                <Button
                    className="flex-1 gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => setMobileStep(mobileStep + 1)}
                >
                    {stepLabels[mobileStep + 1]}
                    <ArrowRight className="h-4 w-4" />
                </Button>
            ) : (
                <Button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex-1 gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? 'Exporting...' : 'Export PDF'}
                </Button>
            )}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Eye className="h-5 w-5" /> PDF Preview — {title || (songs.length === 1 ? songs[0].title : `${songs.length} Songs`)}
                    </DialogTitle>

                    {/* ── Editor Toolbar (Desktop Only) ── */}
                    <div className="hidden md:flex floating-toolbar mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
                            <MousePointerClick className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Click chords/lyrics to edit</span>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={undo}
                            disabled={historyIdx < 0}
                            title="Undo"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={redo}
                            disabled={historyIdx >= history.length - 1}
                            title="Redo"
                        >
                            <Redo2 className="h-3.5 w-3.5" />
                        </Button>
                        <div className="h-4 w-px bg-border" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => setShowStylePanel(!showStylePanel)}
                        >
                            <Palette className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Colors</span>
                        </Button>
                        {hasEdits && (
                            <>
                                <div className="h-4 w-px bg-border" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600 gap-1"
                                    onClick={resetAllEdits}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Reset</span>
                                </Button>
                            </>
                        )}
                    </div>

                    {/* ── Color Picker Panel ── */}
                    {showStylePanel && (
                        <div className="hidden md:flex floating-toolbar mt-1 flex-wrap gap-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chords</span>
                                <div className="flex gap-1">
                                    {CHORD_COLOR_PRESETS.map(preset => (
                                        <button
                                            key={preset.value}
                                            className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${currentEdit.styles.chordColor === preset.value
                                                    ? 'border-white ring-2 ring-offset-2 ring-offset-background ring-primary scale-125'
                                                    : 'border-transparent'
                                                }`}
                                            style={{ background: preset.value || '#3b82f6' }}
                                            onClick={() => handleChordColorChange(preset.value)}
                                            title={preset.label}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="h-4 w-px bg-border" />
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lyrics</span>
                                <div className="flex gap-1">
                                    {LYRIC_COLOR_PRESETS.map(preset => (
                                        <button
                                            key={preset.value || 'default'}
                                            className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${currentEdit.styles.lyricColor === preset.value
                                                    ? 'border-white ring-2 ring-offset-2 ring-offset-background ring-primary scale-125'
                                                    : 'border-transparent'
                                                }`}
                                            style={{ background: preset.value || 'hsl(var(--foreground))' }}
                                            onClick={() => handleLyricColorChange(preset.value)}
                                            title={preset.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                {/* ── Mobile Step Layout ── */}
                <div className="flex flex-col md:hidden flex-1 overflow-hidden">
                    <MobileStepIndicator />
                    {mobileStep === 0 && <MobileStep0 />}
                    {mobileStep === 1 && <MobileStep1 />}
                    {mobileStep === 2 && <MobileStep2 />}
                    <MobileNavButtons />
                </div>

                {/* ── Desktop Layout ── */}
                <div className="hidden md:flex flex-row gap-4 flex-1 overflow-hidden">

                    {/* Left Sidebar: Song List */}
                    {songs.length > 1 && (
                        <div className="lg:w-64 shrink-0 flex flex-col border-r pr-2 overflow-y-auto">
                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-muted-foreground">
                                <ListMusic className="h-4 w-4" /> Song Set List
                            </h3>
                            <div className="space-y-1">
                                {songs.map((song, i) => (
                                    <button
                                        key={song.id}
                                        onClick={() => setSelectedSongId(song.id)}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${selectedSongId === song.id
                                                ? 'bg-purple-100 text-purple-900 font-medium dark:bg-purple-900/30 dark:text-purple-100'
                                                : 'hover:bg-secondary text-muted-foreground'
                                            }`}
                                    >
                                        <div className="truncate">{i + 1}. {song.title}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Middle: Controls Panel */}
                    <div className="lg:w-72 shrink-0 space-y-4 overflow-y-auto pr-2">

                        {/* Transpose */}
                        <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                            <Label className="text-sm font-semibold flex items-center gap-1">
                                <Music className="h-4 w-4" /> Transpose ({currentSong.title})
                            </Label>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => updateTransposition(t => t - 1)}>
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-mono w-8 text-center">{currentTransposition >= 0 ? '+' : ''}{currentTransposition}</span>
                                <Button size="sm" variant="outline" onClick={() => updateTransposition(t => t + 1)}>
                                    <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateTransposition(0)}>
                                    <RotateCcw className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Font Size */}
                        <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                            <Label className="text-sm font-semibold flex items-center gap-1">
                                <Type className="h-4 w-4" /> Global Font Size
                            </Label>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => setFontSize(prev => Math.max(8, prev - 1))}
                                    disabled={fontSize <= 8}
                                >
                                    <span className="text-lg font-bold">−</span>
                                </Button>
                                <div className="flex-1 text-center">
                                    <span className="text-2xl font-bold">{fontSize}</span>
                                    <span className="text-xs text-muted-foreground ml-1">px</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => setFontSize(prev => Math.min(24, prev + 1))}
                                    disabled={fontSize >= 24}
                                >
                                    <span className="text-lg font-bold">+</span>
                                </Button>
                            </div>
                            {/* Visual bar indicator */}
                            <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                                <div
                                    className="bg-primary rounded-full h-1.5 transition-all duration-200"
                                    style={{ width: `${((fontSize - 8) / 16) * 100}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-muted-foreground text-center">
                                {orientation === 'portrait'
                                    ? (fontSize >= 14 ? '1 column' : fontSize >= 10 ? '2 columns' : '3 columns')
                                    : (fontSize <= 10 ? '4 columns' : fontSize <= 13 ? '3 columns' : '2 columns')}
                            </div>
                        </div>

                        {/* Orientation Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                            <Label className="text-sm font-semibold flex items-center gap-1">
                                <MonitorSmartphone className="h-4 w-4" /> Orientation
                            </Label>
                            <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
                                <button
                                    onClick={() => setOrientation('landscape')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${orientation === 'landscape'
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Landscape
                                </button>
                                <button
                                    onClick={() => setOrientation('portrait')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${orientation === 'portrait'
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Portrait
                                </button>
                            </div>
                        </div>

                        {/* Number System Toggle (Desktop) */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                            <Label htmlFor="desktop-number-system" className="text-sm font-semibold flex items-center gap-1">
                                <Music className="h-4 w-4" /> Number System (Global)
                            </Label>
                            <Switch id="desktop-number-system" checked={useNumberSystem} onCheckedChange={setUseNumberSystem} />
                        </div>

                        {/* Per-song Font Size Override */}
                        <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold flex items-center gap-1">
                                    <Type className="h-4 w-4" /> Font: {currentSong.title}
                                </Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                        {currentPerSongFs !== null ? `${currentPerSongFs}px` : 'Global'}
                                    </span>
                                    <Switch
                                        checked={currentPerSongFs !== null}
                                        onCheckedChange={(on) => {
                                            setPerSongFontSize(prev => ({
                                                ...prev,
                                                [currentSong.id]: on ? fontSize : null,
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                            {currentPerSongFs !== null && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => setPerSongFontSize(prev => ({ ...prev, [currentSong.id]: Math.max(8, (currentPerSongFs ?? fontSize) - 1) }))}
                                            disabled={currentPerSongFs <= 8}
                                        >
                                            <span className="text-lg font-bold">−</span>
                                        </Button>
                                        <div className="flex-1 text-center">
                                            <span className="text-2xl font-bold">{currentPerSongFs}</span>
                                            <span className="text-xs text-muted-foreground ml-1">px</span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => setPerSongFontSize(prev => ({ ...prev, [currentSong.id]: Math.min(24, (currentPerSongFs ?? fontSize) + 1) }))}
                                            disabled={currentPerSongFs >= 24}
                                        >
                                            <span className="text-lg font-bold">+</span>
                                        </Button>
                                    </div>
                                    <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                                        <div
                                            className="bg-primary rounded-full h-1.5 transition-all duration-200"
                                            style={{ width: `${((currentPerSongFs - 8) / 16) * 100}%` }}
                                        />
                                    </div>
                                </>
                            )}
                            {/* Font size suggestion */}
                            {(() => {
                                const effFs = currentPerSongFs ?? fontSize;
                                // Build effective lyrics: strip chord markers from sections with chords hidden
                                const effectiveLyrics = currentSections.map((section, idx) => {
                                    const hasChordsVisible = currentVisibility[idx] ?? true;
                                    const lines = section.lines.map(line =>
                                        hasChordsVisible ? line : line.replace(/\[([^\]]+)\]/g, '')
                                    );
                                    return lines.join('\n');
                                }).join('\n\n');
                                const anyChordVisible = currentVisibility.some(v => v);
                                const currentSuggested = suggestFontSize(effectiveLyrics, anyChordVisible, 8, 24, orientation);
                                return currentSuggested < effFs ? (
                                    <div className="mt-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
                                        <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                                <span className="font-bold">{currentSong.title}</span>: use {currentSuggested}px to fit on 1 page
                                            </p>
                                            <Button
                                                size="sm" variant="outline"
                                                className="mt-1 h-5 text-[10px] px-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                                                onClick={() => setPerSongFontSize(prev => ({ ...prev, [currentSong.id]: currentSuggested }))}
                                            >
                                                Apply {currentSuggested}px for this song
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 p-2 rounded-md bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                                        <span className="text-green-500 text-xs">✓</span>
                                        <p className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                                            &quot;{currentSong.title}&quot; fits at {effFs}px
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Use Flats */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                            <Label htmlFor="preview-flats" className="text-sm font-semibold">Use Flats ({currentSong.title})</Label>
                            <Switch id="preview-flats" checked={currentUseFlats} onCheckedChange={updateUseFlats} />
                        </div>

                        {/* Section Chord Controls */}
                        <div className="space-y-2 p-3 rounded-lg border bg-card shadow-sm">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Section Chords ({currentSong.title})</Label>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant={allChordsOn ? 'default' : 'outline'}
                                        className="h-6 text-[10px] px-2"
                                        onClick={() => setAllChords(true)}
                                    >
                                        All On
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={allChordsOff ? 'default' : 'outline'}
                                        className="h-6 text-[10px] px-2"
                                        onClick={() => setAllChords(false)}
                                    >
                                        All Off
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1 mt-2">
                                {currentSections.map((section, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-secondary transition-colors ${currentVisibility[i] ? 'bg-secondary/40' : ''
                                            }`}
                                        onClick={() => toggleSectionChords(i)}
                                    >
                                        <Checkbox
                                            checked={currentVisibility[i]}
                                            onCheckedChange={() => toggleSectionChords(i)}
                                            className="pointer-events-none"
                                        />
                                        <span className="text-xs font-medium flex-1">
                                            {currentEdit.labelOverrides[i] ?? section.label}
                                        </span>
                                        {section.hasChords && (
                                            <Music className="h-3 w-3 text-blue-500" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Interactive Canvas Preview ── */}
                    <div className="flex-1 overflow-y-auto border rounded-lg p-6 bg-white dark:bg-transparent shadow-inner">
                        {/* Song header */}
                        <div className="mb-6 pb-4 border-b">
                            <h2 className="text-2xl font-bold text-foreground">{currentSong.title}</h2>
                            <p className="text-sm text-muted-foreground mt-1">by {currentSong.artist} • {currentSong.genre.join(', ')}</p>
                            {songs.length > 1 && (
                                <div className="mt-3 inline-block px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full font-medium">
                                    Previewing song {songs.findIndex(s => s.id === selectedSongId) + 1} of {songs.length}
                                </div>
                            )}
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                                <MousePointerClick className="h-3 w-3" />
                                Click any chord or lyric to edit • Drag sections to reorder
                            </div>
                        </div>

                        {/* Rendered sections — editable canvas */}
                        <div className="space-y-6">
                            {processedCurrentSections.map((sectionData, displayIdx) => {
                                const { lines, origIdx, label } = sectionData;
                                const isHidden = currentEdit.hiddenSections.has(origIdx);
                                const annotations = currentEdit.annotations[origIdx] || [];

                                return (
                                    <EditableSection
                                        key={`${origIdx}-${displayIdx}`}
                                        sectionIndex={displayIdx}
                                        label={label}
                                        annotations={annotations}
                                        hidden={isHidden}
                                        onLabelEdit={(newLabel) => handleLabelEdit(origIdx, newLabel)}
                                        onAddAnnotation={() => handleAddAnnotation(origIdx)}
                                        onEditAnnotation={(annId, text) => handleEditAnnotation(origIdx, annId, text)}
                                        onAnnotationColorChange={(annId, color) => handleAnnotationColorChange(origIdx, annId, color)}
                                        onDeleteAnnotation={(annId) => handleDeleteAnnotation(origIdx, annId)}
                                        onToggleHide={() => handleToggleHide(origIdx)}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDragEnd={handleDragEnd}
                                        isDragging={dragIdx === displayIdx}
                                        isDropTarget={dropTargetIdx === displayIdx}
                                    >
                                        {!isHidden && lines.map((parsedLine, lIdx) => (
                                            <ChordLyricLine
                                                key={`${origIdx}-${lIdx}`}
                                                parsedLine={parsedLine}
                                                fontSize={fontSize}
                                                editable={true}
                                                chordColor={currentEdit.styles.chordColor || undefined}
                                                lyricColor={currentEdit.styles.lyricColor || undefined}
                                                lineLyricColor={currentEdit.lyricColorOverrides?.[`${origIdx}-${lIdx}`] || undefined}
                                                perChordColors={
                                                    parsedLine.chords.length > 0
                                                        ? Object.fromEntries(
                                                            parsedLine.chords.map((_: any, cIdx: number) => {
                                                                const color = currentEdit.chordColorOverrides?.[`${origIdx}-${lIdx}-${cIdx}`];
                                                                return color ? [cIdx, color] : null;
                                                            }).filter(Boolean) as [number, string][]
                                                        )
                                                        : {}
                                                }
                                                onChordEdit={(cIdx, newChord) => handleChordEdit(origIdx, lIdx, cIdx, newChord)}
                                                onLyricEdit={(newLyrics) => handleLyricEdit(origIdx, lIdx, newLyrics)}
                                                onChordColorChange={(cIdx, color) => handleLineChordColorChange(origIdx, lIdx, cIdx, color)}
                                                onLyricColorChange={(color) => handleLineLyricColorChange(origIdx, lIdx, color)}
                                            />
                                        ))}
                                        {isHidden && (
                                            <p className="text-xs italic text-muted-foreground py-2">Section hidden from export</p>
                                        )}
                                    </EditableSection>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer – desktop only */}
                <DialogFooter className="mt-4 pt-4 border-t hidden md:flex flex-col sm:flex-row gap-2 justify-between items-center bg-background">
                    <div className="text-sm text-muted-foreground hidden sm:flex items-center gap-2">
                        {songs.length > 1 ? `Exporting PDF with ${songs.length} songs` : 'Exporting PDF'}
                        {hasEdits && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold rounded-full">
                                <Paintbrush className="h-2.5 w-2.5" />
                                Custom edits applied
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="bg-purple-600 hover:bg-purple-700 text-white flex gap-2 flex-1 sm:flex-none"
                        >
                            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            {isExporting ? 'Exporting...' : `Export ${songs.length > 1 ? 'Group ' : ''}PDF`}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PdfPreviewModal;
