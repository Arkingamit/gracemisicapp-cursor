const fs = require('fs');
const { Chord, Scale, Key } = require('@tonaljs/tonal');

const output = [
  Chord.get('G').notes.join(', '),
  Chord.get('Em').notes.join(', '),
  Chord.get('C').notes.join(', '),
  Chord.get('D').notes.join(', '),
  Scale.get('G major').notes.join(', '),
  Scale.get('C major').notes.join(', '),
].join('\n');

fs.writeFileSync('test-output2.txt', output, 'utf8');
