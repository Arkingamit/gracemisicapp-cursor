import { convertToChordPro } from './src/lib/chordParser';

const input = `  A         E               F#m  D  A  E
Heaven's gates swing wide`;

console.log("Input:\n" + input);
console.log("\nOutput:\n" + convertToChordPro(input));
