const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'gracemusic');

  console.log('=== Songs with aliases ===');
  const allSongs = await db.collection('songs').find({ aliases: { $exists: true, $ne: [] } }).toArray();
  allSongs.forEach(s => {
    console.log(`ID: ${s._id} | Title: "${s.title}" | Status: ${s.status} | Aliases: ${JSON.stringify(s.aliases || [])}`);
  });

  await client.close();
}

check().catch(console.error);
