import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ParsedLine } from '@/lib/chordParser';
import { ANNOTATION_COLOR_PRESETS } from '@/lib/songEditTypes';

/** Inline color picker that appears when editing a chord or lyric */
const InlineColorPicker: React.FC<{
  currentColor: string;
  position?: { x: number; y: number };
  onPickColor: (color: string) => void;
  onCancel?: () => void;
}> = ({ currentColor, position, onPickColor, onCancel }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onCancel) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className={`absolute z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-xl border border-white/10 ${
        !position ? 'top-[-36px] left-0' : ''
      }`}
      style={{
        ...(position ? { top: position.y, left: position.x } : {}),
        background: 'hsl(240 10% 8% / 0.95)',
        backdropFilter: 'blur(12px)',
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent focus stealing!
    >
      <span className="text-[10px] text-muted-foreground mr-1 whitespace-nowrap">Color:</span>
      {ANNOTATION_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.value}
          className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 ${
            currentColor?.toLowerCase() === preset.value.toLowerCase() ? 'border-white ring-2 ring-offset-1 ring-offset-black ring-primary scale-125' : 'border-white/20'
          }`}
          style={{ backgroundColor: preset.value }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPickColor(preset.value);
          }}
          title={preset.label}
        />
      ))}
      <button
        className="ml-1 text-[10px] text-muted-foreground hover:text-white px-1"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPickColor(''); // reset to default
        }}
        title="Reset to default"
      >
        ✕
      </button>
    </div>
  );
};

interface ChordLyricLineProps {
  parsedLine: ParsedLine;
  fontSize?: number;
  className?: string;
  editable?: boolean;
  showHintBorder?: boolean;
  onChordEdit?: (chordIndex: number, newChord: string) => void;
  onLyricEdit?: (newLyrics: string) => void;
  chordColor?: string;
  lyricColor?: string;
  lineChordColor?: string;
  lineLyricColor?: string;
  onChordColorChange?: (chordIndex: number, color: string) => void;
  onLyricColorChange?: (color: string) => void;
  perChordColors?: Record<number, string>;
}

interface ColoredChar {
  char: string;
  color?: string;
}

// Helper to convert HTML string to an array of characters with their assigned colors
function parseHtmlToColoredChars(htmlOrText: string): ColoredChar[] {
  if (!htmlOrText.includes('<')) {
    return Array.from(htmlOrText).map((char) => ({ char, color: undefined }));
  }

  const div = document.createElement('div');
  div.innerHTML = htmlOrText;

  const result: ColoredChar[] = [];

  function traverse(node: Node, currentColor?: string) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      for (const char of text) {
        result.push({ char, color: currentColor });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      let newColor = currentColor;

      if (el.style.color) {
        newColor = el.style.color;
      } else if (el.hasAttribute('color')) {
        newColor = el.getAttribute('color') || currentColor;
      }

      for (let i = 0; i < el.childNodes.length; i++) {
        traverse(el.childNodes[i], newColor);
      }
    }
  }

  traverse(div);
  return result;
}

// Renders an array of ColoredChars into spans grouped by color
const renderColoredChars = (chars: ColoredChar[], effectiveLineColor: string | undefined) => {
  if (chars.length === 0) return null;
  const spans = [];
  let currentSpan = { text: chars[0].char, color: chars[0].color };

  for (let i = 1; i < chars.length; i++) {
    const c = chars[i];
    if (c.color === currentSpan.color) {
      currentSpan.text += c.char;
    } else {
      spans.push(currentSpan);
      currentSpan = { text: c.char, color: c.color };
    }
  }
  spans.push(currentSpan);

  return spans.map((span, i) => (
    <span key={i} style={{ color: span.color || effectiveLineColor }}>
      {span.text}
    </span>
  ));
};

const ChordLyricLine: React.FC<ChordLyricLineProps> = ({
  parsedLine,
  fontSize = 16,
  className = '',
  editable = false,
  showHintBorder = false,
  onChordEdit,
  onLyricEdit,
  chordColor,
  lyricColor,
  lineChordColor,
  lineLyricColor,
  onChordColorChange,
  perChordColors = {},
}) => {
  const { lyrics, chords } = parsedLine;
  const [editingChordIdx, setEditingChordIdx] = useState<number | null>(null);
  const [isLyricFocused, setIsLyricFocused] = useState(false);
  const [currentLyricColor, setCurrentLyricColor] = useState<string>('');
  const [chordInputValue, setChordInputValue] = useState('');
  
  const chordInputRef = useRef<HTMLInputElement>(null);
  const lyricContentEditableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string>(lyrics || '');

  // Sync lyrics to contentEditable ONLY when not focused, to prevent React from overwriting typed text
  useEffect(() => {
    if (lyricContentEditableRef.current && !isLyricFocused) {
      if (lyricContentEditableRef.current.innerHTML !== (lyrics || '\u00A0')) {
        lyricContentEditableRef.current.innerHTML = lyrics || '\u00A0';
        lastHtml.current = lyrics || '\u00A0';
      }
    }
  }, [lyrics, isLyricFocused]);

  // Color picker state for chords
  const [chordColorTarget, setChordColorTarget] = useState<{ chordIdx: number; pos: { x: number; y: number } } | null>(null);

  const effectiveChordColor = lineChordColor || chordColor || undefined;
  const effectiveLyricColor = lineLyricColor || lyricColor || undefined;

  const coloredChars = useMemo(() => parseHtmlToColoredChars(lyrics), [lyrics]);
  const plainTextLyrics = useMemo(() => coloredChars.map((c) => c.char).join(''), [coloredChars]);

  if (!plainTextLyrics.trim() && chords.length === 0) {
    return <div className={className} style={{ height: `${fontSize}px` }} />;
  }

  const isInlineChordLine = (() => {
    if (chords.length === 0) return false;
    const stripped = plainTextLyrics
      .replace(/\b(intro|chorus|verse|bridge|outro|interlude|tag|solo|inst|instrumental|ending|x\d+|v\d*|c\d*)\b/gi, '')
      .trim();
    return !/[a-zA-Z]/.test(stripped);
  })();

  // ─── Chords Editing ───
  const handleChordClick = (idx: number, chord: string, e: React.MouseEvent) => {
    if (!editable) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setChordColorTarget({
        chordIdx: idx,
        pos: {
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top - 36,
        },
      });
    }
  };

  const startChordEdit = (idx: number) => {
    setChordColorTarget(null);
    setEditingChordIdx(idx);
    setChordInputValue(chords[idx]?.chord || '');
    setTimeout(() => chordInputRef.current?.select(), 10);
  };

  const commitChordEdit = () => {
    if (editingChordIdx !== null && chordInputValue.trim()) {
      onChordEdit?.(editingChordIdx, chordInputValue.trim());
    }
    setEditingChordIdx(null);
  };

  const handleChordColorPick = (color: string) => {
    if (!chordColorTarget) return;
    onChordColorChange?.(chordColorTarget.chordIdx, color);
    startChordEdit(chordColorTarget.chordIdx);
  };

  const commitLyricEdit = () => {
    if (!lyricContentEditableRef.current) return;
    let newHtml = lyricContentEditableRef.current.innerHTML;
    // Sanitize: replace &nbsp; entities and unicode non-breaking spaces with regular spaces
    newHtml = newHtml.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
    // Also update the contentEditable element itself so it stays in sync
    lyricContentEditableRef.current.innerHTML = newHtml;
    if (newHtml !== lyrics && newHtml !== lastHtml.current) {
      lastHtml.current = newHtml;
      onLyricEdit?.(newHtml);
    }
  };

  const updateCurrentLyricColor = () => {
    if (!isLyricFocused) return;
    try {
      const color = document.queryCommandValue('foreColor');
      if (color) {
        let hex = color;
        if (color.startsWith('rgb')) {
           const rgb = color.match(/\d+/g);
           if (rgb && rgb.length >= 3) {
             hex = '#' + rgb.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
           }
        }
        setCurrentLyricColor(hex.toLowerCase());
      }
    } catch (e) {}
  };

  const applyInlineColorToLyrics = (color: string) => {
    // We use document.execCommand to natively style the current selection or upcoming text
    document.execCommand('styleWithCSS', false, 'true');
    if (color === '') {
      document.execCommand('removeFormat', false, '');
      document.execCommand('foreColor', false, effectiveLyricColor || '#ffffff');
    } else {
      document.execCommand('foreColor', false, color);
    }
    setCurrentLyricColor(color.toLowerCase());
  };

  // ─── Build Segments ───
  const buildSegments = () => {
    const hasChords = chords.length > 0;
    const segments: { chordPart: string; lyricPartChars: ColoredChar[]; chordIndices: number[] }[] = [];

    const wordRegex = /(\S+\s*)/g;
    let match;
    let lastEnd = 0;

    while ((match = wordRegex.exec(plainTextLyrics)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (start > lastEnd) {
        const gapLen = start - lastEnd;
        let gapChordPart = ' '.repeat(gapLen);
        if (hasChords) {
          let gapCursor = 0;
          chords.forEach((c) => {
            if (c.position >= lastEnd && c.position < start) {
              let relPos = c.position - lastEnd;
              if (gapCursor > 0 && relPos < gapCursor + 1) relPos = gapCursor + 1;
              if (relPos + c.chord.length > gapChordPart.length) {
                gapChordPart = gapChordPart.padEnd(relPos + c.chord.length, ' ');
              }
              gapChordPart =
                gapChordPart.substring(0, relPos) +
                c.chord +
                gapChordPart.substring(relPos + c.chord.length);
              gapCursor = relPos + c.chord.length;
            }
          });
        }
        segments.push({
          chordPart: gapChordPart,
          lyricPartChars: coloredChars.slice(lastEnd, start),
          chordIndices: [],
        });
      }

      const indices = chords.reduce<number[]>((acc, c, idx) => {
        if (c.position >= start && c.position < end) acc.push(idx);
        return acc;
      }, []);

      let minLength = match[0].length;
      for (const idx of indices) {
        const c = chords[idx];
        const relPos = c.position - start;
        const needed = relPos + c.chord.length;
        if (needed > minLength) minLength = needed;
      }

      let chordPart = ' '.repeat(minLength);
      let cursor = 0;
      for (const idx of indices) {
        const c = chords[idx];
        let relPos = c.position - start;
        if (cursor > 0 && relPos < cursor + 1) relPos = cursor + 1;
        if (relPos + c.chord.length > chordPart.length) {
          chordPart = chordPart.padEnd(relPos + c.chord.length, ' ');
        }
        chordPart =
          chordPart.substring(0, relPos) +
          c.chord +
          chordPart.substring(relPos + c.chord.length);
        cursor = relPos + c.chord.length;
      }

      segments.push({
        chordPart,
        lyricPartChars: coloredChars.slice(start, end),
        chordIndices: indices,
      });
      lastEnd = end;
    }

    if (lastEnd < plainTextLyrics.length) {
      const remainingLen = plainTextLyrics.length - lastEnd;
      const indices = chords.reduce<number[]>((acc, c, idx) => {
        if (c.position >= lastEnd) acc.push(idx);
        return acc;
      }, []);
      let chordPart = ' '.repeat(remainingLen);
      let remCursor = 0;
      for (const idx of indices) {
        const c = chords[idx];
        let relPos = c.position - lastEnd;
        if (remCursor > 0 && relPos < remCursor + 1) relPos = remCursor + 1;
        if (relPos + c.chord.length > chordPart.length) {
          chordPart = chordPart.padEnd(relPos + c.chord.length, ' ');
        }
        chordPart =
          chordPart.substring(0, relPos) +
          c.chord +
          chordPart.substring(relPos + c.chord.length);
        remCursor = relPos + c.chord.length;
      }
      segments.push({
        chordPart,
        lyricPartChars: coloredChars.slice(lastEnd),
        chordIndices: indices,
      });
    }

    if (hasChords) {
      const trailingIndices = chords.reduce<number[]>((acc, c, idx) => {
        if (c.position >= plainTextLyrics.length) acc.push(idx);
        return acc;
      }, []);
      if (trailingIndices.length > 0) {
        const lastChordIdx = trailingIndices[trailingIndices.length - 1];
        const lastC = chords[lastChordIdx];
        const totalLen = (lastC.position - plainTextLyrics.length) + lastC.chord.length;
        let chordPart = ' '.repeat(totalLen + trailingIndices.length);
        let trailCursor = 0;
        for (const idx of trailingIndices) {
          const c = chords[idx];
          let relPos = c.position - plainTextLyrics.length;
          if (trailCursor > 0 && relPos < trailCursor + 1) relPos = trailCursor + 1;
          if (relPos + c.chord.length > chordPart.length) {
            chordPart = chordPart.padEnd(relPos + c.chord.length, ' ');
          }
          chordPart =
            chordPart.substring(0, relPos) +
            c.chord +
            chordPart.substring(relPos + c.chord.length);
          trailCursor = relPos + c.chord.length;
        }
        segments.push({
          chordPart,
          lyricPartChars: [],
          chordIndices: trailingIndices,
        });
      }
    }

    return { segments, hasChords };
  };

  const { segments, hasChords } = buildSegments();

  // ─── Render chord tokens ───
  const renderChordPart = (chordPart: string, chordIndices: number[], segFontSize: number) => {
    const hasVisibleChord = chordPart.trim().length > 0;
    if (!editable || chordIndices.length === 0) {
      return (
        <span
          className={`${editable ? 'editable-chord' : ''} text-blue-500 font-bold block${hasVisibleChord ? ' pr-3' : ''}`}
          style={{
            fontSize: `${segFontSize * 0.85}px`,
            lineHeight: 1.2,
            color: effectiveChordColor,
          }}
        >
          {chordPart || '\u00A0'}
        </span>
      );
    }

    const tokens: React.ReactNode[] = [];
    let lastPos = 0;

    chordIndices.forEach((chordIdx) => {
      const chord = chords[chordIdx];
      const segStartInLyrics = (() => {
        let pos = 0;
        for (const seg of segments) {
          if (seg.chordIndices.includes(chordIdx)) return pos;
          pos += seg.lyricPartChars.length;
        }
        return 0;
      })();
      const relPos = chord.position - segStartInLyrics;

      if (relPos > lastPos) {
        tokens.push(
          <span key={`sp-${chordIdx}`} className="whitespace-pre">
            {chordPart.substring(lastPos, relPos)}
          </span>
        );
      }

      const thisChordColor = perChordColors[chordIdx] || effectiveChordColor;

      if (editingChordIdx === chordIdx) {
        tokens.push(
          <input
            key={`edit-${chordIdx}`}
            ref={chordInputRef}
            className="editing-chord font-bold text-center bg-transparent border-none p-0 m-0 leading-none min-w-[2ch]"
            style={{
              fontSize: `${segFontSize * 0.85}px`,
              width: `${Math.max(chordInputValue.length + 1, 3)}ch`,
              color: thisChordColor,
            }}
            value={chordInputValue}
            onChange={(e) => setChordInputValue(e.target.value)}
            onBlur={commitChordEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitChordEdit();
              if (e.key === 'Escape') setEditingChordIdx(null);
            }}
          />
        );
      } else {
        tokens.push(
          <span
            key={`chord-${chordIdx}`}
            className={`editable-chord inline-block ${showHintBorder ? 'hint-border' : ''}`}
            style={{ color: thisChordColor }}
            onClick={(e) => handleChordClick(chordIdx, chord.chord, e)}
            title="Click to edit chord"
          >
            {chord.chord}
          </span>
        );
      }
      lastPos = relPos + chord.chord.length;
    });

    if (lastPos < chordPart.length) {
      tokens.push(
        <span key="trail" className="whitespace-pre">
          {chordPart.substring(lastPos)}
        </span>
      );
    }

    const hasVisibleChordEditable = chordPart.trim().length > 0;
    return (
      <span
        className={`text-blue-500 font-bold block${hasVisibleChordEditable ? ' pr-3' : ''}`}
        style={{
          fontSize: `${segFontSize * 0.85}px`,
          lineHeight: 1.2,
          color: effectiveChordColor,
        }}
      >
        {tokens.length > 0 ? tokens : '\u00A0'}
      </span>
    );
  };

  // ─── Inline Chord Line rendering ───
  if (isInlineChordLine && !editable) {
    const tokens: React.ReactNode[] = [];
    let lastPos = 0;

    chords.forEach((chordObj, i) => {
      if (chordObj.position > lastPos) {
        tokens.push(
          <span key={`text-${i}`}>
            {renderColoredChars(coloredChars.slice(lastPos, chordObj.position), effectiveLyricColor)}
          </span>
        );
      }
      const thisChordColor = perChordColors[i] || effectiveChordColor;
      tokens.push(
        <span
          key={`chord-${i}`}
          className={`text-blue-500 font-bold pr-2 ${editable ? 'cursor-pointer hover:underline' : ''}`}
          style={{ fontSize: `${fontSize * 0.85}px`, color: thisChordColor }}
          onClick={(e) => {
            if (editable) handleChordClick(i, chordObj.chord, e);
          }}
        >
          {chordObj.chord}
        </span>
      );
      lastPos = chordObj.position;
    });

    if (lastPos < coloredChars.length) {
      tokens.push(
        <span key="text-end">
          {renderColoredChars(coloredChars.slice(lastPos), effectiveLyricColor)}
        </span>
      );
    }

    return (
      <div ref={containerRef} className={`font-mono whitespace-pre-wrap relative ${className}`} style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
        {chordColorTarget && (
          <InlineColorPicker
            currentColor={perChordColors[chordColorTarget.chordIdx] || effectiveChordColor || ''}
            position={chordColorTarget.pos}
            onPickColor={handleChordColorPick}
            onCancel={() => {
              startChordEdit(chordColorTarget.chordIdx);
            }}
          />
        )}
        <div className="flex flex-wrap items-center">
          {tokens}
        </div>
      </div>
    );
  }

  // ─── Render Read-Only / Rich Text Edit Mode ───
  return (
    <div ref={containerRef} className={`font-mono relative ${className}`} style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}>
      {chordColorTarget && (
        <InlineColorPicker
          currentColor={perChordColors[chordColorTarget.chordIdx] || effectiveChordColor || ''}
          position={chordColorTarget.pos}
          onPickColor={handleChordColorPick}
          onCancel={() => {
            startChordEdit(chordColorTarget.chordIdx);
          }}
        />
      )}
      
      {/* When editing lyrics, show the inline color picker dynamically anchored above the editing area */}
      {isLyricFocused && (
        <InlineColorPicker
          currentColor={currentLyricColor}
          onPickColor={applyInlineColorToLyrics}
        />
      )}

      {editable ? (
        <div className="relative">
          {hasChords && (
            <div className="flex flex-wrap mb-1 relative z-10">
              {segments.map((seg, i) => (
                <span key={i} className="inline-block whitespace-pre">
                  {renderChordPart(seg.chordPart, seg.chordIndices, fontSize)}
                </span>
              ))}
            </div>
          )}
          <div
            ref={lyricContentEditableRef}
            contentEditable
            suppressContentEditableWarning
            className={`w-full font-mono block outline-none rounded px-1 py-0.5 text-foreground transition-all duration-150 ${
              isLyricFocused || showHintBorder 
                ? 'editing-lyric border border-primary/50 bg-background' 
                : 'hover:bg-primary/5 cursor-text border border-transparent'
            }`}
            style={{ fontSize: `${fontSize}px`, minHeight: `${fontSize * 1.5}px` }}
            onFocus={() => {
              setIsLyricFocused(true);
              setTimeout(updateCurrentLyricColor, 10);
            }}
            onBlur={(e) => {
              if (e.relatedTarget && (e.relatedTarget as Element).closest('.color-picker-panel')) return;
              setIsLyricFocused(false);
              commitLyricEdit();
            }}
            onMouseUp={updateCurrentLyricColor}
            onKeyUp={(e) => {
              updateCurrentLyricColor();
              if (e.key === 'Escape') {
                e.preventDefault();
                lyricContentEditableRef.current?.blur();
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                lyricContentEditableRef.current?.blur();
              }
            }}
          />
        </div>
      ) : (
        <div className="flex flex-wrap">
          {segments.map((seg, i) => (
            <span key={i} className="inline-block whitespace-pre">
              {hasChords && renderChordPart(seg.chordPart, seg.chordIndices, fontSize)}
              <span
                className="block"
                style={{ color: effectiveLyricColor }}
              >
                {renderColoredChars(seg.lyricPartChars, effectiveLyricColor) || (hasChords ? '' : '\u00A0')}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChordLyricLine;
