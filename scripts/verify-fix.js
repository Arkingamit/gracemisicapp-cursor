const { detectKey } = require('./src/lib/keyDetection');

const lyrics = `
[Em] [C] [Am] [Em]
Hmm...

[Em] [C] [Bm]
Praise the exalted Holy God

[Em] [C] [Am] [Em]
You're the one we call the true Almighty God

[Em] [C] [D] [C] [B]
Holy, Holy, King of glo--ry
`;

// Mocking the imports since this is running in Node and the file uses ESM
// I will instead create a standalone test file that doesn't involve the project's TS config for quick verification.
console.log("Detected Key:", detectKey(lyrics));
