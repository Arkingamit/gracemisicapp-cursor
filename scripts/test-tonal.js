const { Chord, Scale, Key } = require('@tonaljs/tonal');

console.log(Chord.get('G').notes);
console.log(Chord.get('Em').notes);
console.log(Chord.get('C').notes);
console.log(Chord.get('D').notes);

console.log(Scale.get('G major').notes);
console.log(Scale.get('C major').notes);
