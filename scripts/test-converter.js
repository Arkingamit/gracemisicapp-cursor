require('ts-node').register({ transpileOnly: true });
const { convertToChordPro } = require('./src/lib/chordParser.ts');

const input = `Em         C            G
Water You turned into wine
Em         C            G
Opened the eyes of the blind
                 Am
There's no one like You
           D
None like You
Em         C            G
Into the darkness You shine
Em         C            G
Out of the ashes we rise
                Am
There's no one like You
           D
None like You`;

console.log("--- INPUT ---");
console.log(input);
console.log("\n--- CONVERTED TO CHORDPRO ---");
const result = convertToChordPro(input);
console.log(result);

// Let's also test a single chord line at the end
const edgeCase = `A        B
Here is some text
C`;

console.log("\n--- EDGE CASE ---");
console.log(convertToChordPro(edgeCase));
