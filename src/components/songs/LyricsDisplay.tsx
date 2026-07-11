import React, { useState, useMemo, useEffect } from 'react';
import ChordLyricLine from './ChordLyricLine';
import EditableSection from './EditableSection';
import { parseLineWithChords, transposeParsedLine, splitIntoSections, SongSection, ParsedLine } from '@/lib/chordParser';
import { convertToNumberSystem } from '@/lib/chordUtils';
import { Music, Music4, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SongEditState, Annotation, createEmptyEditState } from '@/lib/songEditTypes';

interface LyricsDisplayProps {
  lyrics: string;
  transposition?: number;
  useFlats?: boolean;
  className?: string;
  fontSize?: number;
  format?: 'auto' | 'chordpro';
  useNumberSystem?: boolean;
  currentKey?: string;

  // Editor mode props
  editable?: boolean;
  editState?: SongEditState;
  onChordEdit?: (sIdx: number, lIdx: number, cIdx: number, newChord: string) => void;
  onLyricEdit?: (sIdx: number, lIdx: number, newLyric: string) => void;
  onSectionReorder?: (newOrder: number[]) => void;
  onSectionToggleHide?: (sIdx: number) => void;
  onLabelEdit?: (sIdx: number, newLabel: string) => void;
  onAddAnnotation?: (sIdx: number) => void;
  onEditAnnotation?: (sIdx: number, annId: string, text: string) => void;
  onAnnotationColorChange?: (sIdx: number, annId: string, color: string) => void;
  onDeleteAnnotation?: (sIdx: number, annId: string) => void;
  onChordColorChange?: (sIdx: number, lIdx: number, cIdx: number, color: string) => void;
  onLyricColorChange?: (sIdx: number, lIdx: number, color: string) => void;
  chordHighlight?: boolean;
  hideAllChords?: boolean;
  onHideAllChordsChange?: (hide: boolean) => void;
  lightTheme?: boolean;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  transposition = 0,
  useFlats = false,
  className = '',
  fontSize = 16,
  format = 'auto',
  useNumberSystem = false,
  currentKey = 'C',
  editable = false,
  editState,
  onChordEdit,
  onLyricEdit,
  onSectionReorder,
  onSectionToggleHide,
  onLabelEdit,
  onAddAnnotation,
  onEditAnnotation,
  onAnnotationColorChange,
  onDeleteAnnotation,
  onChordColorChange,
  onLyricColorChange,
  chordHighlight = false,
  hideAllChords = false,
  onHideAllChordsChange,
  lightTheme = false,
}) => {
  const sections = useMemo(() => splitIntoSections(lyrics, format), [lyrics, format]);

  // Local state for per-section chord visibility (view-only mode toggle)
  const [sectionVisibility, setSectionVisibility] = useState<boolean[]>([]);
  
  // Drag and drop local state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  // Initialize visibility state when sections change
  useEffect(() => {
    const timer = setTimeout(() => {
      setSectionVisibility(sections.map(() => true));
    }, 0);
    return () => clearTimeout(timer);
  }, [sections]);

  const toggleSection = (index: number) => {
    setSectionVisibility(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const toggleAll = () => {
    const allOn = sectionVisibility.every(Boolean);
    setSectionVisibility(sections.map(() => !allOn));
  };

  if (!lyrics || sections.length === 0) return null;

  // Use provided edit state or create default
  const currentEdit = editState || createEmptyEditState(sections);

  // Process sections: handle sectionOrder, transpose, and apply visibility
  // Always use the saved section order if available and valid
  const displayOrder = currentEdit.sectionOrder.length === sections.length 
    ? currentEdit.sectionOrder 
    : sections.map((_, i) => i);

  const processedSections = displayOrder.map((origIdx) => {
    const section = sections[origIdx];
    if (!section) return null;
    
    // In edit mode, hidden sections are controlled by editState. In view mode, they are completely removed.
    const isHiddenExport = currentEdit.hiddenSections.includes(origIdx);
    if (!editable && isHiddenExport) return null;

    const showChords = !hideAllChords && (sectionVisibility[origIdx] ?? true);
    const label = currentEdit.labelOverrides[origIdx] || section.label;
    
    const processedLines = section.lines.map((line, lIdx) => {
      const parsed = parseLineWithChords(line);
      const transposed = transposeParsedLine(parsed, transposition, useFlats);
      
      // Apply lyric overrides first (always applies whether chords are shown or not)
      if (currentEdit.lyricOverrides[`${origIdx}-${lIdx}`] !== undefined) {
        transposed.lyrics = currentEdit.lyricOverrides[`${origIdx}-${lIdx}`];
      }
      
      if (!showChords) {
        return { lyrics: transposed.lyrics, chords: [] };
      }

      // Convert chords to NNS if toggle is enabled
      if (useNumberSystem && currentKey) {
        transposed.chords = transposed.chords.map(c => ({
          ...c,
          chord: convertToNumberSystem(c.chord, currentKey)
        }));
      }

      // Apply chord overrides
      transposed.chords = transposed.chords.map((c, cIdx) => {
        const overrideKey = `${origIdx}-${lIdx}-${cIdx}`;
        if (currentEdit.chordOverrides[overrideKey]) {
          return { ...c, chord: currentEdit.chordOverrides[overrideKey] };
        }
        return c;
      });

      return transposed;
    });

    return { ...section, origIdx, label, processedLines, showChords, isHiddenExport };
  }).filter(Boolean) as (typeof sections[0] & { origIdx: number; label: string; processedLines: ParsedLine[]; showChords: boolean; isHiddenExport: boolean })[];

  // ─── Drag and Drop Handlers ───
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to allow the drag image to capture the un-faded element
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx === null || dragIdx === index) return;
    setDropTargetIdx(index);
  };

  const handleDragEnd = () => {
    if (dragIdx !== null && dropTargetIdx !== null && dragIdx !== dropTargetIdx && onSectionReorder) {
      const newOrder = [...currentEdit.sectionOrder];
      const [movedItem] = newOrder.splice(dragIdx, 1);
      newOrder.splice(dropTargetIdx, 0, movedItem);
      onSectionReorder(newOrder);
    }
    setDragIdx(null);
    setDropTargetIdx(null);
  };


  const allOn = sectionVisibility.every(Boolean);

  const renderSection = (section: typeof processedSections[0], displayIdx: number) => {
    const { origIdx, label, isHiddenExport, processedLines } = section;
    const annotations = currentEdit.annotations[origIdx] || [];

    const content = (
      <div className="space-y-1.5">
        {processedLines.map((line, lIdx) => (
          <ChordLyricLine 
            key={`${origIdx}-${lIdx}`} 
            parsedLine={line} 
            fontSize={fontSize}
            editable={editable}
            chordColor={currentEdit.styles.chordColor || undefined}
            lyricColor={currentEdit.styles.lyricColor || undefined}
            lineLyricColor={currentEdit.lyricColorOverrides?.[`${origIdx}-${lIdx}`] || undefined}
            chordHighlight={chordHighlight}
            lightTheme={lightTheme}
            perChordColors={
              line.chords.length > 0
                ? Object.fromEntries(
                    line.chords.map((_: unknown, cIdx: number) => {
                      const color = currentEdit.chordColorOverrides?.[`${origIdx}-${lIdx}-${cIdx}`];
                      return color ? [cIdx, color] : null;
                    }).filter(Boolean) as [number, string][]
                  )
                : {}
            }
            onChordEdit={(cIdx, newChord) => onChordEdit?.(origIdx, lIdx, cIdx, newChord)}
            onLyricEdit={(newLyrics) => onLyricEdit?.(origIdx, lIdx, newLyrics)}
            onChordColorChange={(cIdx, color) => onChordColorChange?.(origIdx, lIdx, cIdx, color)}
            onLyricColorChange={(color) => onLyricColorChange?.(origIdx, lIdx, color)}
          />
        ))}
      </div>
    );

    if (editable) {
      return (
        <div key={`edit-${origIdx}-${displayIdx}`} className="mb-6 break-inside-avoid">
          <EditableSection
            sectionIndex={displayIdx}
            label={label}
            annotations={annotations}
            hidden={isHiddenExport}
            fontSize={fontSize}
            onLabelEdit={(newLabel) => onLabelEdit?.(origIdx, newLabel)}
            onAddAnnotation={() => onAddAnnotation?.(origIdx)}
            onEditAnnotation={(annId, text) => onEditAnnotation?.(origIdx, annId, text)}
            onAnnotationColorChange={(annId, color) => onAnnotationColorChange?.(origIdx, annId, color)}
            onDeleteAnnotation={(annId) => onDeleteAnnotation?.(origIdx, annId)}
            onToggleHide={() => onSectionToggleHide?.(origIdx)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            isDragging={dragIdx === displayIdx}
            isDropTarget={dropTargetIdx === displayIdx}
          >
            {content}
            {isHiddenExport && (
              <p className="text-xs italic text-muted-foreground py-2">Section hidden from view/export</p>
            )}
          </EditableSection>
        </div>
      );
    }

    return (
      <div key={origIdx} className="relative group mb-6 break-inside-avoid">
        <div className="flex items-center gap-2 mb-2">
          <span 
            className="font-semibold font-heading opacity-80 decoration-muted-foreground/30 flex items-center gap-2"
            style={{ fontSize: `${fontSize}px` }}
          >
            {label}
            {annotations.filter(a => a.text.trim()).map(a => (
              <span 
                key={a.id} 
                className="font-medium px-1.5 py-0.5 rounded"
                style={{ 
                  fontSize: `${fontSize * 0.85}px`,
                  color: a.color || '#a855f7',
                  backgroundColor: a.color 
                    ? `${a.color}15` 
                    : 'rgba(168, 85, 247, 0.08)',
                }}
              >
                {a.text}
              </span>
            ))}
          </span>
          
          {/* Inline Toggle Button */}
          {section.hasChords && (
            <button
              onClick={() => toggleSection(origIdx)}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary inline-flex items-center gap-1 ${
                !section.showChords ? 'opacity-100 text-muted-foreground' : 'text-primary'
              }`}
              title={section.showChords ? "Hide chords for this section" : "Show chords for this section"}
            >
              {section.showChords ? <Music className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          )}
        </div>

        {content}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Master Toggle (only show if there are chords to toggle) */}
      {sections.some(s => s.hasChords) && onHideAllChordsChange && (
        <div className="flex justify-end mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onHideAllChordsChange(!hideAllChords)}
            className="h-8 text-xs flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            {!hideAllChords ? <EyeOff className="h-3 w-3" /> : <Music4 className="h-3 w-3" />}
            {!hideAllChords ? 'Hide All Chords' : 'Show All Chords'}
          </Button>
        </div>
      )}

      {/* Mobile: Single column */}
      <div className="block md:hidden">
        {processedSections.map((section, idx) => renderSection(section, idx))}
      </div>

      {/* Desktop: CSS columns — force 3 columns */}
      <div className="hidden md:block" style={{ columns: 3, columnGap: '3rem' }}>
        {processedSections.map((section, idx) => renderSection(section, idx))}
      </div>
    </div>
  );
};

export default LyricsDisplay;
