import { Song } from './types';
import { transposeLyrics, convertToNumberSystem, getTransposedKeyName } from './chordUtils';
import { parseLineWithChords } from './chordParser';
import { detectKey } from './keyDetection';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export type PdfOrientation = 'landscape' | 'portrait';

export interface PdfExportOptions {
  showChords: boolean;
  transposition?: number;
  useFlats?: boolean;
  fontSize: number;
  /** Page orientation: landscape (default) or portrait */
  orientation?: PdfOrientation;
  /** Per-song style overrides from the Canva editor */
  editOverrides?: Record<string, { chordColor: string; lyricColor: string }>;
  useNumberSystem?: boolean;
}

// Determine how many columns to use based on font size and orientation
const getColumnCount = (fontSize: number, orientation: PdfOrientation = 'landscape'): number => {
  if (orientation === 'portrait') {
    // Portrait has less width, so use fewer columns
    if (fontSize >= 14) return 1;
    if (fontSize >= 10) return 2;
    return 3;
  }
  // Landscape (original behavior)
  if (fontSize >= 16) return 2;
  if (fontSize >= 12) return 3;
  return 4;
};

// Calculate column width based on number of columns
const calcColumnWidth = (pageWidth: number, margin: number, numColumns: number): number => {
  return (pageWidth - ((numColumns + 1) * margin)) / numColumns;
};

// ─── Rich Text HTML Parsing ───

interface ColoredChar {
  char: string;
  color?: string;
}

function parseHtmlToColoredChars(htmlOrText: string): ColoredChar[] {
  if (typeof document === 'undefined') {
    const stripped = htmlOrText.replace(/<[^>]*>?/gm, '');
    return Array.from(stripped).map(char => ({ char, color: undefined }));
  }

  if (!htmlOrText.includes('<')) {
    return Array.from(htmlOrText).map(char => ({ char, color: undefined }));
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
      if (el.style.color) newColor = el.style.color;
      else if (el.hasAttribute('color')) newColor = el.getAttribute('color') || currentColor;
      
      for (let i = 0; i < el.childNodes.length; i++) {
        traverse(el.childNodes[i], newColor);
      }
    }
  }

  traverse(div);
  return result;
}

function applyColorToPdf(doc: any, colorStr: string | undefined, defaultColor: number[] = [0, 0, 0]) {
  if (!colorStr) {
    doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]);
    return;
  }
  if (colorStr.startsWith('#')) {
    doc.setTextColor(colorStr);
    return;
  }
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    doc.setTextColor(parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10));
    return;
  }
  doc.setTextColor(colorStr); // fallback
}

// Calculate column start X positions
const calcColumnStartXs = (margin: number, colWidth: number, numColumns: number): number[] => {
  const xs: number[] = [];
  for (let i = 0; i < numColumns; i++) {
    xs.push(margin + i * (colWidth + margin));
  }
  return xs;
};

/**
 * Estimates the ideal font size so a given song's lyrics fit on a single page.
 * Returns a number between minFont and maxFont.
 */
export const suggestFontSize = (
  lyrics: string,
  showChords: boolean,
  minFont = 8,
  maxFont = 24,
  orientation: PdfOrientation = 'landscape'
): number => {
  // A4 dimensions: 297mm x 210mm
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;
  const bottomMargin = pageHeight - 20;
  const topStart = 50;
  const usableHeight = bottomMargin - topStart;
  const margin = 15;

  const lines = lyrics.split('\n');
  const chordRegex = /\[(.*?)\]/g;

  for (let fs = maxFont; fs >= minFont; fs--) {
    const numCols = getColumnCount(fs, orientation);
    const colWidth = calcColumnWidth(pageWidth, margin, numCols);
    const lineSpacing = fs * 0.35;
    const chordRowHeight = (fs - 2) * 0.4;
    const gap = fs * 0.15;

    // Estimate total height needed if all lines flow into available columns
    let totalHeight = 0;
    lines.forEach(line => {
      const isChord = showChords && !!line.match(chordRegex);
      const plainText = line.replace(chordRegex, '');
      
      // Approximate wrap count: text length * approximate char width vs column width
      const approxCharWidthMm = fs * 0.22; // rough estimate for helvetica
      const textWidthMm = (plainText.length || 1) * approxCharWidthMm;
      const wrapCount = Math.max(1, Math.ceil(textWidthMm / colWidth));

      if (isChord) {
        totalHeight += chordRowHeight + wrapCount * lineSpacing + gap;
      } else {
        totalHeight += wrapCount * lineSpacing + gap;
      }
    });

    const totalUsable = usableHeight * numCols;
    if (totalHeight <= totalUsable) {
      return fs;
    }
  }
  return minFont;
};

const loadImageAsBase64 = (src: string, opacity: number = 1): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const maxWidth = 550;
      const scale = maxWidth / img.width;
      const width = maxWidth;
      const height = img.height * scale;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, 0, 0, width, height);
      }

      const dataURL = canvas.toDataURL('image/jpeg');
      resolve(dataURL);
    };
    img.onerror = () => {
      console.warn(`Failed to load image at ${src}`);
      resolve('');
    };
    img.src = src;
  });
};

// Load a TTF font file and return as base64 string
const loadFontAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Detect if a string contains Devanagari (Hindi) characters
const containsDevanagari = (text: string): boolean => {
  return /[\u0900-\u097F]/.test(text);
};

export const generateSongPdf = async (
  songs: (Song & { transposition?: number; useFlats?: boolean; perSongFontSize?: number })[],
  options: PdfExportOptions,
  groupName?: string
) => {
  const { default: jsPDF } = await import('jspdf');
  const orientation = options.orientation || 'landscape';
  const doc = new jsPDF(orientation === 'portrait' ? 'portrait' : 'landscape', 'mm', 'a4');

  // Load and register Unicode fonts for Hindi/Devanagari support
  try {
    const [notoSansBase64, notoDevanagariBase64, robotoMonoBase64] = await Promise.all([
      loadFontAsBase64('/fonts/NotoSans-Regular.ttf'),
      loadFontAsBase64('/fonts/NotoSansDevanagari-Regular.ttf'),
      loadFontAsBase64('/fonts/RobotoMono-Regular.ttf'),
    ]);

    doc.addFileToVFS('NotoSans-Regular.ttf', notoSansBase64);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'bold'); // Register regular as bold fallback

    doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', notoDevanagariBase64);
    doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari', 'normal');

    doc.addFileToVFS('RobotoMono-Regular.ttf', robotoMonoBase64);
    doc.addFont('RobotoMono-Regular.ttf', 'RobotoMono', 'normal');
  } catch (e) {
    console.warn('Could not load custom fonts, falling back to helvetica', e);
  }

  // Helper: set the right font based on whether text has Hindi characters
  const setFontForText = (text: string, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    if (containsDevanagari(text)) {
      doc.setFont('NotoSansDevanagari', 'normal');
    } else {
      doc.setFont('NotoSans', style);
    }
  };

  // A4 dimensions based on orientation
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;
  const margin = 15;

  const logoBase64 = await loadImageAsBase64('/lovable-uploads/gracelogo.png', 0.6);

  const addWatermark = () => {
    if (!logoBase64) return;
    const logoWidth = 60;
    const logoHeight = 40;
    const logoX = pageWidth - logoWidth - 10;
    const logoY = 10;
    
    // Format should be PNG since we are using a PNG file, but toDataURL returns image/jpeg from the canvas right now.
    // However, jsPDF can usually handle it if we just pass 'JPEG' because of our canvas manipulation.
    doc.addImage(
      logoBase64,
      'JPEG',
      logoX,
      logoY,
      logoWidth,
      logoHeight
    );

    // Add the link at the bottom
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const linkText = 'https://music.graceahmedabad.org/about';
    // Using regular text, most PDF viewers auto-link URLs
    doc.text(linkText, pageWidth / 2, pageHeight - 8, { align: 'center' });
    
    // Add clickable link over the logo
    doc.link(logoX, logoY, logoWidth, logoHeight, { url: linkText });
    
    // Reset styling
    doc.setTextColor(0, 0, 0);
  };

  const coverTitle = groupName ? `Songs from ${groupName}` : 'Song Collection';
  doc.setFontSize(32);
  setFontForText(coverTitle, 'bold');
  doc.text(coverTitle, pageWidth / 2, 60, { align: 'center' });
  doc.setFontSize(16);
  setFontForText('Generated');
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 80, { align: 'center' });
  doc.text(`Total: ${songs.length} songs`, pageWidth / 2, 100, { align: 'center' });
  addWatermark();

  doc.addPage();
  doc.setFontSize(24);
  setFontForText('Table of Contents', 'bold');
  doc.text('Table of Contents', margin, 30);
  doc.setFontSize(14);

  let yPos = 50;
  const tocPageNumWidth = 30; // reserve space for page number on the right
  const tocMaxTextWidth = pageWidth - margin * 2 - tocPageNumWidth;
  songs.forEach((song, index) => {
    const pageNumber = index + 3;
    const tocLine = `${index + 1}. ${song.title} - ${song.artist}`;
    setFontForText(tocLine);
    const wrappedTocLines: string[] = doc.splitTextToSize(tocLine, tocMaxTextWidth);
    
    // Check if we need a new page before rendering
    const tocBlockHeight = wrappedTocLines.length * 6;
    if (yPos + tocBlockHeight > pageHeight - 30) {
      addWatermark();
      doc.addPage();
      yPos = 30;
    }
    
    wrappedTocLines.forEach((wLine: string, wIdx: number) => {
      doc.text(wLine, margin, yPos);
      if (wIdx === 0) {
        // Page number on the first line only
        setFontForText(`${pageNumber}`);
        doc.text(`${pageNumber}`, pageWidth - margin, yPos, { align: 'right' });
      }
      yPos += 6;
    });
    yPos += 2; // small gap between entries
  });
  addWatermark();

  const cleanChord = (chord: string): string => {
    return chord.replace(/Major/g, '').replace(/Minor/g, 'm').trim();
  };

  songs.forEach((song) => {
    doc.addPage();
    addWatermark();

    // 1. Column and Font Size Logic
    const songFontSize = song.perSongFontSize ?? options.fontSize;
    const songNumColumns = getColumnCount(songFontSize, orientation);
    const songColumnWidth = calcColumnWidth(pageWidth, margin, songNumColumns);
    const columnStartX = calcColumnStartXs(margin, songColumnWidth, songNumColumns);

    // 2. Color Override Logic (Canva Editor)
    const songOverrides = options.editOverrides?.[song.id];
    const chordColorHex = songOverrides?.chordColor || '';
    const lyricColorHex = songOverrides?.lyricColor || '';

    const setChordColor = () => {
      if (chordColorHex) {
        const r = parseInt(chordColorHex.slice(1, 3), 16);
        const g = parseInt(chordColorHex.slice(3, 5), 16);
        const b = parseInt(chordColorHex.slice(5, 7), 16);
        doc.setTextColor(r, g, b);
      } else {
        doc.setTextColor(220, 38, 38); // Default RED (Tailwind red-600)
      }
    };
    
    // --- Helper for missing space width in custom fonts ---
    const getSafeTextWidth = (text: string) => {
      let width = doc.getTextWidth(text);
      // If the font fails to report space widths properly (e.g. NotoSans via VFS)
      // the width will be identical to the string without spaces.
      if (text.includes(' ') && width === doc.getTextWidth(text.replace(/ /g, ''))) {
        const spaceWidth = doc.getTextWidth('t'); // fallback approximate space width
        const numSpaces = (text.match(/ /g) || []).length;
        width += numSpaces * spaceWidth;
      }
      return width;
    };

    const wrapTextExact = (text: string, maxWidth: number): string[] => {
      if (!text) return [''];
      const lines: string[] = [];
      let currentLine = '';
      let lastSpaceIndex = -1;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ' ') lastSpaceIndex = currentLine.length;
        
        const testLine = currentLine + char;
        if (getSafeTextWidth(testLine) > maxWidth && currentLine.length > 0) {
          if (lastSpaceIndex !== -1 && lastSpaceIndex > 0) {
            const lineToPush = currentLine.substring(0, lastSpaceIndex + 1);
            lines.push(lineToPush);
            currentLine = currentLine.substring(lastSpaceIndex + 1) + char;
            lastSpaceIndex = (char === ' ' ? currentLine.length - 1 : -1);
          } else {
            lines.push(currentLine);
            currentLine = char;
            lastSpaceIndex = (char === ' ' ? 0 : -1);
          }
        } else {
          currentLine += char;
        }
      }
      if (currentLine.length > 0) lines.push(currentLine);
      return lines;
    };

    const setLyricColor = () => {
      if (lyricColorHex) {
        const r = parseInt(lyricColorHex.slice(1, 3), 16);
        const g = parseInt(lyricColorHex.slice(3, 5), 16);
        const b = parseInt(lyricColorHex.slice(5, 7), 16);
        doc.setTextColor(r, g, b);
      } else {
        doc.setTextColor(0, 0, 0);
      }
    };

    const resetColor = () => doc.setTextColor(0, 0, 0);

    // Render Title and Artist — wrap to avoid overlapping the watermark
    const logoReservedWidth = 80; // space for the watermark logo on the right
    const titleMaxWidth = pageWidth - margin - logoReservedWidth;

    doc.setFontSize(20);
    setFontForText(song.title, 'bold');
    const wrappedTitle: string[] = doc.splitTextToSize(song.title, titleMaxWidth);
    let titleY = 25;
    wrappedTitle.forEach((tLine: string) => {
      doc.text(tLine, margin, titleY);
      titleY += 8;
    });

    doc.setFontSize(14);
    const artistLine = `by ${song.artist}`;
    setFontForText(artistLine);
    const wrappedArtist: string[] = doc.splitTextToSize(artistLine, titleMaxWidth);
    wrappedArtist.forEach((aLine: string) => {
      doc.text(aLine, margin, titleY);
      titleY += 6;
    });

    const lyrics = song.lyrics;
    const transposedLyrics =
      song.transposition && song.transposition !== 0
        ? transposeLyrics(lyrics, song.transposition, song.useFlats)
        : lyrics;

    const originalKey = song.originalKey || detectKey(lyrics);
    const currentKey = originalKey ? getTransposedKeyName(originalKey, song.transposition || 0) : 'Unknown';

    const lines = transposedLyrics.split('\n');
    const chordRegex = /\[(.*?)\]/g;
    const bottomMargin = pageHeight - 20;

    // Track current column and y position — start below the title/artist block
    let currentColumn = 0;
    let yPosition = Math.max(titleY + 5, 50); // ensure at least 50mm from top

    const startNewPage = () => {
      addWatermark();
      doc.addPage();
      addWatermark();
      doc.setFontSize(12);
      setFontForText(`${song.title} (continued)`, 'bold');
      doc.text(`${song.title} (continued)`, margin, 15);
      currentColumn = 0;
      yPosition = 25;
    };

    const moveToNextColumn = () => {
      if (currentColumn < songNumColumns - 1) {
        currentColumn++;
        yPosition = 50;
      } else {
        startNewPage();
      }
    };

    // Helper: check if we have enough space, if not move to next column/page
    const ensureSpace = (neededHeight: number) => {
      if (yPosition + neededHeight > bottomMargin) {
        moveToNextColumn();
      }
    };

    // Section header regex — matches labels like "Verse", "Chorus 2", "Pre-Chorus", "Ending Bridge" etc.
    const sectionHeaderRegex = /^\s*(Verse|Chorus|Bridge|Pre-Chorus|Intro|Outro|Instrumental|Solo|Tag|End|Ending|Interlude)(\s+\d+)?\s*$/i;

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Check for section headers BEFORE chord detection to avoid misidentifying them
      const isSectionHeader = sectionHeaderRegex.test(trimmedLine) ||
        (trimmedLine.startsWith('[') && trimmedLine.endsWith(']') &&
         sectionHeaderRegex.test(trimmedLine.slice(1, -1)));

      if (isSectionHeader) {
        // Render as section label (bold, gray)
        const lyricFontSize = songFontSize;
        const lineSpacing = lyricFontSize * 0.35;
        const displayText = trimmedLine.replace(/^\[|\]$/g, ''); // strip brackets if present

        ensureSpace(lineSpacing + lyricFontSize * 0.15);
        const sx = columnStartX[currentColumn];

        doc.setFontSize(lyricFontSize);
        setFontForText(displayText, 'bold');
        doc.setTextColor(100, 100, 100); // gray for section headers
        doc.text(displayText, sx, yPosition);
        yPosition += lineSpacing;
        resetColor();
        yPosition += lyricFontSize * 0.15;
        return; // skip chord processing for this line
      }

      const isChordLine = options.showChords && !!line.match(chordRegex);
      const rawHtmlText = line.replace(chordRegex, '');
      const coloredChars = parseHtmlToColoredChars(rawHtmlText);
      const plainText = coloredChars.map(c => c.char).join('');

      if (isChordLine) {
        // --- Render chord line above the lyric ---
        const chordFontSize = songFontSize - 2;
        const lyricFontSize = songFontSize;
        const lineSpacing = lyricFontSize * 0.35; // mm per line of text

        // Calculate how many wrapped lines the lyric text will need
        doc.setFontSize(lyricFontSize);
        setFontForText(plainText);
        const wrappedLyricLines: string[] = wrapTextExact(plainText, songColumnWidth);
        const wrappedLyricCount = Math.max(wrappedLyricLines.length, 1);

        // Total height: chord row + all wrapped lyric rows
        const chordRowHeight = chordFontSize * 0.4;
        const totalHeight = chordRowHeight + wrappedLyricCount * lineSpacing + lyricFontSize * 0.3;

        ensureSpace(totalHeight);
        const sx = columnStartX[currentColumn]; // re-read after possible column change

        // Use the same parser as the web view for correct chord positions
        const parsed = parseLineWithChords(line);

        let charIdx = 0;
        wrappedLyricLines.forEach((wrappedLine: string, lineIndex: number) => {
          let cursorX = sx;
          
          const startIdx = charIdx;
          const endIdx = charIdx + wrappedLine.length;
          
          // Filter chords that belong to this wrapped line
          const lineChords = parsed.chords.filter(c => {
             if (lineIndex === wrappedLyricLines.length - 1 && c.position >= endIdx) return true;
             return c.position >= charIdx && c.position < endIdx;
          });

          // 1. Render Chords
          if (lineChords.length > 0 || lineIndex === 0) {
            let lastChordEndX = sx;
            lineChords.forEach(({ chord, position }) => {
              let cleanedChord = cleanChord(chord);
              if (options.useNumberSystem && currentKey && currentKey !== 'Unknown') {
                cleanedChord = convertToNumberSystem(cleanedChord, currentKey);
              }
              
              doc.setFontSize(lyricFontSize);
              setFontForText(plainText);
              // Calculate width relative to the start of THIS wrapped line
              const relativePos = Math.max(0, position - charIdx);
              const prefixText = wrappedLine.substring(0, relativePos);
              let chordX = sx + getSafeTextWidth(prefixText);
              
              doc.setFontSize(chordFontSize);
              doc.setFont('RobotoMono', 'normal');
              
              const minGap = getSafeTextWidth('  ');
              if (chordX < lastChordEndX + minGap) {
                chordX = lastChordEndX + minGap;
              }

              if (chordX < sx + songColumnWidth) {
                setChordColor();
                doc.text(cleanedChord, chordX, yPosition);
                resetColor();
                lastChordEndX = chordX + doc.getTextWidth(cleanedChord);
              }
            });
            yPosition += chordRowHeight;
          }

          // 2. Render Lyrics
          doc.setFontSize(lyricFontSize);
          setFontForText(plainText);
          const lineChars = coloredChars.slice(charIdx, endIdx);
          
          if (lineChars.length === 0) {
            doc.text(wrappedLine, sx, yPosition);
          } else {
            let currentSpan = { text: '', color: lineChars[0].color };
            const spans = [];
            lineChars.forEach(c => {
              if (c.color === currentSpan.color) {
                currentSpan.text += c.char;
              } else {
                if (currentSpan.text) spans.push(currentSpan);
                currentSpan = { text: c.char, color: c.color };
              }
            });
            if (currentSpan.text) spans.push(currentSpan);
            
            spans.forEach(span => {
              if (span.color) {
                applyColorToPdf(doc, span.color);
              } else {
                setLyricColor();
              }
              doc.text(span.text, cursorX, yPosition);
              cursorX += doc.getTextWidth(span.text);
            });
          }
          
          yPosition += lineSpacing;
          charIdx += wrappedLine.length;
        });
        resetColor();

        yPosition += lyricFontSize * 0.15; // small gap after a chord+lyric block
      } else {
        // --- Plain lyric or empty line (no chords) ---
        const lyricFontSize = songFontSize;
        const lineSpacing = lyricFontSize * 0.35;

        // Check if this is an annotation line (starts with parentheses or is a [Section])
        const isAnnotation = plainText.trim().startsWith('(') && plainText.trim().endsWith(')');
        const isSection = plainText.trim().startsWith('[') && plainText.trim().endsWith(']');
        
        if (isAnnotation) {
          setFontForText(plainText, 'italic');
          doc.setTextColor(120, 80, 160); // purple-ish for annotations
        } else if (isSection) {
          setFontForText(plainText, 'bold');
          doc.setTextColor(100, 100, 100); // grayish for sections
        } else {
          setFontForText(plainText);
          setLyricColor();
        }

        doc.setFontSize(lyricFontSize);
        const wrappedLines: string[] = wrapTextExact(plainText || ' ', songColumnWidth);

        const totalHeight = wrappedLines.length * lineSpacing;
        ensureSpace(totalHeight);
        const sx = columnStartX[currentColumn];

        let charIdx = 0;
        wrappedLines.forEach((wrappedLine: string) => {
          let cursorX = sx;
          
          const startIdx = charIdx;
          const endIdx = charIdx + wrappedLine.length;
          
          const lineChars = coloredChars.slice(charIdx, endIdx);
          
          if (lineChars.length === 0 || isAnnotation || isSection) {
            doc.text(wrappedLine, sx, yPosition);
          } else {
            let currentSpan = { text: '', color: lineChars[0].color };
            const spans = [];
            lineChars.forEach(c => {
              if (c.color === currentSpan.color) {
                currentSpan.text += c.char;
              } else {
                if (currentSpan.text) spans.push(currentSpan);
                currentSpan = { text: c.char, color: c.color };
              }
            });
            if (currentSpan.text) spans.push(currentSpan);
            
            spans.forEach(span => {
              if (span.color) {
                applyColorToPdf(doc, span.color);
              } else {
                setLyricColor();
              }
              doc.text(span.text, cursorX, yPosition);
              cursorX += doc.getTextWidth(span.text);
            });
          }
          
          yPosition += lineSpacing;
          charIdx += wrappedLine.length;
        });

        resetColor();
        setFontForText(' ');
        yPosition += lyricFontSize * 0.15;
      }
    });
  });

  const filename = `songs${groupName ? '-' + groupName.replace(/\s+/g, '-').toLowerCase() : ''}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const base64data = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64data,
        directory: Directory.Cache
      });
      
      await Share.share({
        title: filename,
        text: 'Shared Song Set from Grace App',
        url: savedFile.uri,
        dialogTitle: 'Save or Share PDF'
      });
    } catch (e) {
      console.error('Error saving PDF natively', e);
      // Fallback if native saving fails
      doc.save(filename);
    }
  } else {
    doc.save(filename);
  }
};
