import { parseLineWithChords } from './src/lib/chordParser';

const testLine = "He[A]aven's gat[E]es swing wide   [F#m]     [D]   [A]   [E]";
const parsed = parseLineWithChords(testLine);
console.log("Input:", testLine);
console.log("Parsed Lyrics:", parsed.lyrics);
console.log("Parsed Chords:", parsed.chords);
