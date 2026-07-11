const https = require('https');
const fs = require('fs');

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Status ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

Promise.all([
  download('https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Regular.ttf', 'public/fonts/Inter-Regular.ttf'),
  download('https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-SemiBold.ttf', 'public/fonts/Inter-SemiBold.ttf'),
  download('https://github.com/googlefonts/RobotoMono/raw/main/fonts/ttf/RobotoMono-Regular.ttf', 'public/fonts/RobotoMono-Regular.ttf')
]).then(() => console.log('Downloaded all TTF')).catch(console.error);
