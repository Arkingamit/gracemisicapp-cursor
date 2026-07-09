
// Standalone logic check
function toSongGenre(docGenre) {
  // Logic from SongModel.toSong
  const rawGenre = Array.isArray(docGenre) ? docGenre : (docGenre ? [docGenre] : []);
  const genre = rawGenre
    .filter((g) => typeof g === 'string' && g.trim() !== '')
    .map((g) => g.trim());
  return genre;
}

function indexTrimLogic(g) {
  // Logic from Index.tsx
  return typeof g === 'string' ? g.trim() : '';
}

// Mock MongoDB document genres
const testCases = [
  { input: 'Worship', expected: ['Worship'], name: 'Legacy String' },
  { input: ['Praise', null, '', '  ', 'Rock '], expected: ['Praise', 'Rock'], name: 'Messy Array' },
  { input: { name: 'Oops' }, expected: [], name: 'Invalid Object' },
  { input: undefined, expected: [], name: 'Undefined' },
  { input: [123, 'Blues'], expected: ['Blues'], name: 'Mixed Array' }
];

console.log('--- Testing Backend Normalization Logic ---');
testCases.forEach(tc => {
  const result = toSongGenre(tc.input);
  const passed = JSON.stringify(result) === JSON.stringify(tc.expected);
  console.log(`${passed ? '✅' : '❌'} ${tc.name}: ${JSON.stringify(tc.input)} -> ${JSON.stringify(result)}`);
});

console.log('\n--- Testing Frontend Safety Logic ---');
const frontendTestCases = [
  { input: ' Worship ', expected: 'Worship', name: 'Valid String' },
  { input: null, expected: '', name: 'Null' },
  { input: undefined, expected: '', name: 'Undefined' },
  { input: { obj: 1 }, expected: '', name: 'Object' },
  { input: 42, expected: '', name: 'Number' }
];

frontendTestCases.forEach(tc => {
  const result = indexTrimLogic(tc.input);
  const passed = result === tc.expected;
  console.log(`${passed ? '✅' : '❌'} ${tc.name}: ${JSON.stringify(tc.input)} -> ${JSON.stringify(result)}`);
});
