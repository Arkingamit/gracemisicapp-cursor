import { parseLineWithChords } from './src/lib/chordParser';

const testLine1 = "[B]Heaven's [F#]gates swing [G#m]wide [E]";
const parsed1 = parseLineWithChords(testLine1);
console.log("Input:", testLine1);
console.log("Lyrics:", parsed1.lyrics);
console.log("Chords:", parsed1.chords);
console.log("Length of lyrics:", parsed1.lyrics.length);

const testLine2 = "  [D]               [A]";
const parsed2 = parseLineWithChords(testLine2);
console.log("Input:", testLine2);
console.log("Lyrics:", parsed2.lyrics);
console.log("Chords:", parsed2.chords);
console.log("Length of lyrics:", parsed2.lyrics.length);
