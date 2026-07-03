"use strict";
// lib/chordParser.ts
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transposeChord = transposeChord;
exports.convertToChordPro = convertToChordPro;
exports.parseLineWithChords = parseLineWithChords;
exports.transposeParsedLine = transposeParsedLine;
exports.parseSongWithChordsInChunks = parseSongWithChordsInChunks;
exports.detectSectionLabel = detectSectionLabel;
exports.splitIntoSections = splitIntoSections;
// ─── Chromatic scale lookup tables (no external dependency) ───
var SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// Map every common note name to its semitone index (0-11)
var NOTE_TO_INDEX = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0,
};
// Regex to extract the root note from a chord string (e.g., "C#m7" → "C#", "Dsus4" → "D")
var ROOT_NOTE_REGEX = /^([A-G][#b]?)/;
/**
 * Transpose a single note name by N semitones.
 */
function transposeNote(note, semitones, useFlats) {
    var index = NOTE_TO_INDEX[note];
    if (index === undefined)
        return note;
    var scale = useFlats ? FLATS : SHARPS;
    var newIndex = ((index + semitones) % 12 + 12) % 12;
    return scale[newIndex];
}
/**
 * Transpose a single chord part (no slash).
 * Extracts root note, transposes it, re-attaches the suffix.
 */
function transposeChordPart(chordPart, semitones, useFlats) {
    var match = chordPart.match(ROOT_NOTE_REGEX);
    if (!match)
        return chordPart; // not a recognizable chord, return as-is
    var rootNote = match[1];
    var suffix = chordPart.substring(rootNote.length); // everything after the root (m, 7, sus4, add9, dim, etc.)
    var transposedRoot = transposeNote(rootNote, semitones, useFlats);
    return transposedRoot + suffix;
}
/**
 * Transpose a single chord string by N semitones.
 * Handles slash chords (D/F#), sus/add/dim/aug/maj chords, and any suffix.
 */
function transposeChord(chord, semitones, useFlats) {
    if (useFlats === void 0) { useFlats = false; }
    if (!chord || semitones === 0)
        return chord;
    // Handle slash chords: split on '/', transpose each part separately
    if (chord.includes('/')) {
        var parts = chord.split('/');
        return parts.map(function (part) { return transposeChordPart(part.trim(), semitones, useFlats); }).join('/');
    }
    return transposeChordPart(chord, semitones, useFlats);
}
// ─── ChordPro Conversion ───
// Regex pattern for chords including sharps, flats, minors, maj, sus, add, slashes
var CHORD_REGEX = /(?:^|\s|\[)[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|aad|[M\+\-\d])*(?:\/[A-G][#b]?)?(?=\s|\]|$)/;
// Regex to detect section headers like [Chorus], [Verse 2], etc.
var SECTION_HEADER_REGEX = /^\[(Verse|Chorus|Bridge|Pre-Chorus|Intro|Outro|Instrumental|Solo|Tag|End|Interlude|Ending).*\]$/i;
/**
 * Convert a "chords over lyrics" song text into ChordPro format ([C]lyrics).
 * Uses a proper chord regex to detect chord lines and merges them inline
 * with the lyric line below. Section headers like [Verse 1] are preserved
 * with brackets stripped.
 */
function convertToChordPro(rawText) {
    if (!rawText)
        return '';
    var lines = rawText.split('\n');
    var result = [];
    var i = 0;
    while (i < lines.length) {
        var line = lines[i].replace(/\r$/, '');
        // Empty lines pass through
        if (line.trim().length === 0) {
            result.push('');
            i++;
            continue;
        }
        // Detect section headers like [Chorus], [Verse 2] and strip the outer brackets
        if (SECTION_HEADER_REGEX.test(line.trim())) {
            var cleanHeader = line.trim().replace(/^\[|\]$/g, '');
            result.push(cleanHeader);
            i++;
            continue;
        }
        // If this line contains chords and a next line exists, merge them inline
        if (i + 1 < lines.length && line.trim().length > 0) {
            var nextLine = lines[i + 1];
            // Check all tokens on this line look like chords (avoid treating lyric lines as chord lines)
            var tokens = line.trim().split(/\s+/);
            var allTokensAreChords = tokens.length > 0 && tokens.every(function (token) {
                var clean = token.replace(/^\[|\]$/g, '');
                return /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|aad|[M\+\-\d])*(?:\/[A-G][#b]?)?$/.test(clean);
            });
            if (allTokensAreChords) {
                result.push(mergeChordsInline(line, nextLine));
                i += 2;
                continue;
            }
        }
        // Default: pass through as-is
        result.push(line);
        i++;
    }
    return result.join('\n');
}
/**
 * Merge a chord line into a lyric line by inserting [Chord] at the correct
 * character positions. Inserts backwards to preserve earlier positions.
 */
function mergeChordsInline(chordLine, lyricLine) {
    // Find each chord token and its character position in the chord line
    var chordPositions = [];
    var tokens = chordLine.split(/(\s+)/); // split keeping whitespace
    var cursor = 0;
    for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
        var token = tokens_1[_i];
        if (token.trim().length > 0) {
            chordPositions.push({ chord: token, position: cursor });
        }
        cursor += token.length;
    }
    // Find the maximum position needed
    var maxPos = chordPositions.length > 0 ? chordPositions[chordPositions.length - 1].position : 0;
    var merged = lyricLine;
    // Right-pad the lyric line if it's too short, so trailing chords don't condense
    if (merged.length < maxPos) {
        merged = merged.padEnd(maxPos, ' ');
    }
    // Insert chords backwards to avoid shifting positions
    for (var j = chordPositions.length - 1; j >= 0; j--) {
        var _a = chordPositions[j], chord = _a.chord, position = _a.position;
        // We already padded the string, so we can insert directly at position
        merged = merged.slice(0, position) + "[".concat(chord, "]") + merged.slice(position);
    }
    return merged;
}
// ─── Line Parsing ───
function stripHtml(html) {
    if (typeof document !== 'undefined') {
        var tmp = document.createElement("div");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }
    return html.replace(/<[^>]*>?/gm, '');
}
function parseLineWithChords(line) {
    var chords = [];
    var lyrics = '';
    var currentPos = 0;
    var lyricsPos = 0;
    var chordRegex = /\[([^\]]+)\]/g;
    var match;
    while ((match = chordRegex.exec(line)) !== null) {
        var chordStart = match.index;
        var chord = match[1];
        var textBefore = line.substring(currentPos, chordStart);
        lyrics += textBefore;
        lyricsPos += stripHtml(textBefore).length;
        chords.push({ chord: chord, position: lyricsPos });
        currentPos = chordStart + match[0].length;
    }
    lyrics += line.substring(currentPos);
    return { lyrics: lyrics, chords: chords };
}
// ─── Transposition of Parsed Lines ───
function transposeParsedLine(parsedLine, semitones, useFlats) {
    if (useFlats === void 0) { useFlats = false; }
    return {
        lyrics: parsedLine.lyrics,
        chords: parsedLine.chords.map(function (chordPos) { return (__assign(__assign({}, chordPos), { chord: transposeChord(chordPos.chord, semitones, useFlats) })); })
    };
}
function parseSongWithChordsInChunks(song, chunkSize) {
    if (chunkSize === void 0) { chunkSize = 40; }
    var tokenRegex = /(\[([^\]]+)\])|([^\s]+)/g;
    var chunks = [];
    var currentLyrics = '';
    var currentChords = [];
    var currentChunkWordCount = 0;
    var currentLyricsPos = 0;
    var match;
    while ((match = tokenRegex.exec(song)) !== null) {
        var fullMatch = match[0], bracketed = match[1], chordName = match[2], lyricWord = match[3];
        if (bracketed && chordName) {
            currentChords.push({ chord: chordName, position: currentLyricsPos });
        }
        else if (lyricWord) {
            currentLyrics += lyricWord + ' ';
            currentLyricsPos += lyricWord.length + 1;
            currentChunkWordCount++;
        }
        if (currentChunkWordCount >= chunkSize) {
            chunks.push({
                lyrics: currentLyrics.trim(),
                chords: __spreadArray([], currentChords, true)
            });
            currentLyrics = '';
            currentChords = [];
            currentChunkWordCount = 0;
            currentLyricsPos = 0;
        }
    }
    if (currentLyrics.trim().length > 0) {
        chunks.push({
            lyrics: currentLyrics.trim(),
            chords: __spreadArray([], currentChords, true)
        });
    }
    return chunks;
}
/** Detect a section label from the first line content */
function detectSectionLabel(lines, index) {
    var _a;
    var firstLine = ((_a = lines[0]) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || '';
    // Check for explicit section markers
    var sectionPatterns = [
        [/^\[?(verse|v)\s*(\d+)?\]?:?\s*$/i, 'Verse'],
        [/^\[?(chorus|ch)\]?:?\s*$/i, 'Chorus'],
        [/^\[?(bridge|br)\]?:?\s*$/i, 'Bridge'],
        [/^\[?(pre-?chorus|pc)\]?:?\s*$/i, 'Pre-Chorus'],
        [/^\[?(outro)\]?:?\s*$/i, 'Outro'],
        [/^\[?(intro)\]?:?\s*$/i, 'Intro'],
        [/^\[?(tag)\]?:?\s*$/i, 'Tag'],
        [/^\[?(interlude)\]?:?\s*$/i, 'Interlude'],
        [/^\[?(ending)\]?:?\s*$/i, 'Ending'],
        [/^\[?(end)\]?:?\s*$/i, 'End'],
    ];
    for (var _i = 0, sectionPatterns_1 = sectionPatterns; _i < sectionPatterns_1.length; _i++) {
        var _b = sectionPatterns_1[_i], pattern = _b[0], label = _b[1];
        var match = firstLine.match(pattern);
        if (match) {
            var num = match[2] ? " ".concat(match[2]) : '';
            return "".concat(label).concat(num);
        }
    }
    return "Section ".concat(index + 1);
}
/** Split lyrics into sections separated by blank lines */
function splitIntoSections(lyrics, format) {
    if (format === void 0) { format = 'auto'; }
    var chordProLyrics = format === 'chordpro' ? lyrics : convertToChordPro(lyrics);
    var allLines = chordProLyrics.split('\n');
    var sections = [];
    var currentLines = [];
    for (var _i = 0, allLines_1 = allLines; _i < allLines_1.length; _i++) {
        var line = allLines_1[_i];
        if (line.trim() === '') {
            if (currentLines.length > 0) {
                sections.push(buildSection(currentLines, sections.length));
                currentLines = [];
            }
        }
        else {
            currentLines.push(line);
        }
    }
    if (currentLines.length > 0) {
        sections.push(buildSection(currentLines, sections.length));
    }
    return sections;
}
function buildSection(lines, index) {
    var chordRegex = /\[([^\]]+)\]/;
    var label = detectSectionLabel(lines, index);
    // If the first line was used as a section label, remove it from content lines
    // so it doesn't render twice (once as label, once as lyric)
    var contentLines = lines;
    if (label !== "Section ".concat(index + 1) && lines.length > 0) {
        contentLines = lines.slice(1);
    }
    var hasChords = contentLines.some(function (l) { return chordRegex.test(l); });
    return { label: label, lines: contentLines, hasChords: hasChords };
}
