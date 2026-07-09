import { detectKey } from './src/lib/keyDetection';
import { convertToChordPro } from './src/lib/chordParser';

const rawLyrics = `
D          Em
Tere jaisa kaun hain
A          Bm
Jo mera bhala kare
G          Em      A
Mera bharosa sirf tuzpar prabhu
`;

const chordpro = convertToChordPro(rawLyrics);
console.log('Chordpro:\n', chordpro);

console.log('Detected Key:', detectKey(chordpro));
