"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectKey = detectKey;
var tonal_1 = require("@tonaljs/tonal");
var chordParser_1 = require("./chordParser");
// Section labels to ignore when extracting chords
var SECTION_LABELS = ['verse', 'chorus', 'bridge', 'intro', 'outro', 'instrumental', 'tag', 'interlude', 'pre-chorus', 'ending', 'end', 'solo'];
/**
 * Extract all chords from lyrics (ignoring section labels)
 */
function extractAllChords(lyrics) {
    if (!lyrics)
        return [];
    // First normalize to chordpro format so we can extract bracketed chords
    var normalizedLyrics = (0, chordParser_1.convertToChordPro)(lyrics);
    var chordMatches = normalizedLyrics.match(/\[([^\]]+)\]/g) || [];
    var chords = chordMatches
        .map(function (chord) { return chord.slice(1, -1).trim(); })
        .filter(function (chord) {
        if (!chord)
            return false;
        var lowerChord = chord.toLowerCase();
        // Ignore section labels
        if (SECTION_LABELS.some(function (label) { return lowerChord.includes(label); }))
            return false;
        // Basic check: must start with A-G
        return /^[A-G]/.test(chord);
    });
    return chords; // Do not use Set so we can count frequencies
}
/**
 * Get the root note from a chord string using simple regex
 */
function getChordRoot(chord) {
    var noteMatch = chord.match(/^([A-G][#b]?)/);
    return noteMatch ? noteMatch[1] : null;
}
/**
 * Analyze chords to determine the most likely key.
 * If the root (first) chord is minor, returns a minor key name (e.g. "Am").
 */
function detectKey(lyrics) {
    var chords = extractAllChords(lyrics);
    if (chords.length === 0) {
        return ''; // No chords found, so no key can be detected
    }
    // Count frequency of each chord
    var chordFrequency = chords.reduce(function (acc, chord) {
        acc[chord] = (acc[chord] || 0) + 1;
        return acc;
    }, {});
    var ALL_MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C#', 'F#'];
    var bestKey = getChordRoot(chords[0]) || 'C';
    var bestScore = -1;
    // Expected diatonic qualities for major scale degrees 1 through 7
    // I, ii, iii, IV, V, vi, vii°
    var EXPECTED_QUALITIES = [
        'Major', // I
        'Minor', // ii
        'Minor', // iii
        'Major', // IV
        'Major', // V
        'Minor', // vi
        'Diminished' // vii°
    ];
    // Pre-parse the song's chords
    var parsedChords = Object.entries(chordFrequency).map(function (_a) {
        var chordName = _a[0], freq = _a[1];
        var chordInfo = tonal_1.Chord.get(chordName);
        var tonic = chordInfo.empty ? getChordRoot(chordName) : chordInfo.tonic;
        var quality = chordInfo.empty ? 'Major' : chordInfo.quality; // fallback to Major if unknown
        var chroma = tonic ? tonal_1.Note.chroma(tonic) : null;
        return { chordName: chordName, freq: freq, chroma: chroma, quality: quality };
    });
    // Detect if the first chord is minor
    var firstChordInfo = tonal_1.Chord.get(chords[0]);
    var firstChordIsMinor = firstChordInfo.quality === 'Minor';
    var firstChordRoot = getChordRoot(chords[0]);
    for (var _i = 0, ALL_MAJOR_KEYS_1 = ALL_MAJOR_KEYS; _i < ALL_MAJOR_KEYS_1.length; _i++) {
        var potentialKey = ALL_MAJOR_KEYS_1[_i];
        try {
            var majorScale = tonal_1.Scale.get("".concat(potentialKey, " major"));
            var scaleNotes = majorScale.notes;
            if (!scaleNotes || scaleNotes.length === 0)
                continue;
            // Extract the chroma for each of the 7 degrees of the scale
            var degreeChromas = scaleNotes.map(function (n) { return tonal_1.Note.chroma(n); });
            var score = 0;
            for (var _a = 0, parsedChords_1 = parsedChords; _a < parsedChords_1.length; _a++) {
                var _b = parsedChords_1[_a], freq = _b.freq, chroma = _b.chroma, quality = _b.quality;
                if (chroma === null || chroma === undefined)
                    continue;
                // Check if the chord's root note belongs to this major scale
                var degreeIndex = degreeChromas.indexOf(chroma);
                if (degreeIndex !== -1) {
                    // The root note is in the scale!
                    var expectedQuality = EXPECTED_QUALITIES[degreeIndex];
                    if (quality === expectedQuality) {
                        // Perfect match for both root and quality (e.g. 'Am' as the ii chord in G major)
                        score += freq * 3;
                        // Extra bonus for the I, IV, and V chords as they strongly define the key
                        if (degreeIndex === 0 || degreeIndex === 3 || degreeIndex === 4) {
                            score += freq * 2;
                        }
                    }
                    else {
                        // Root is in the key, but quality is different (e.g. a borrowed chord)
                        score += freq * 1;
                    }
                }
            }
            // Bonus if the first chord root matches the tonic
            if (firstChordRoot) {
                var rootChroma = tonal_1.Note.chroma(firstChordRoot);
                var keyChroma = tonal_1.Note.chroma(potentialKey);
                if (rootChroma !== undefined && rootChroma === keyChroma) {
                    score += 10; // Strong indicator
                }
            }
            // Bonus if the last chord root matches the tonic
            var lastChordRoot = getChordRoot(chords[chords.length - 1]);
            if (lastChordRoot) {
                var rootChroma = tonal_1.Note.chroma(lastChordRoot);
                var keyChroma = tonal_1.Note.chroma(potentialKey);
                if (rootChroma !== undefined && rootChroma === keyChroma) {
                    score += 10; // Strong indicator
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestKey = potentialKey;
            }
        }
        catch (error) {
            continue;
        }
    }
    // If the first chord is minor, return the relative minor key.
    // The relative minor of a major key is the vi degree (index 5),
    // which is 9 semitones above (or 3 below) the major root.
    if (firstChordIsMinor && firstChordRoot) {
        var firstChordChroma = tonal_1.Note.chroma(firstChordRoot);
        var bestKeyChroma = tonal_1.Note.chroma(bestKey);
        if (firstChordChroma !== undefined && bestKeyChroma !== undefined) {
            // Check if the first chord root is the vi degree of the detected major key
            // (vi = relative minor), i.e. firstChordChroma === (bestKeyChroma + 9) % 12
            var relativeMinorChroma = (bestKeyChroma + 9) % 12;
            if (firstChordChroma === relativeMinorChroma) {
                // The detected major key's relative minor matches the first chord — return minor key
                return firstChordRoot + 'm';
            }
            // Even if the first chord minor root doesn't match the vi of detected key,
            // but the song starts on a minor chord, treat it as that minor key
            return firstChordRoot + 'm';
        }
    }
    return bestKey;
}
