const fs = require('fs');

try {
  const content1 = fs.readFileSync('output.txt', 'utf16le');
  fs.writeFileSync('output-utf8.txt', content1, 'utf8');
} catch(e) { console.log(e); }

try {
  const content2 = fs.readFileSync('seed-out.txt', 'utf16le');
  fs.writeFileSync('seed-out-utf8.txt', content2, 'utf8');
} catch(e) { console.log(e); }
