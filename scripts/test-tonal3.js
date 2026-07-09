const fs = require('fs');
const { Note } = require('@tonaljs/tonal');

const output = [
  Note.chroma('G') === Note.chroma('G'),
  Note.chroma('F#') === Note.chroma('Gb'),
  Note.chroma('C') === Note.chroma('B#'),
  Note.chroma('invalid'),
  Note.chroma('A')
].join('\n');

fs.writeFileSync('test-tonal3.txt', output, 'utf8');
