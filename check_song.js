const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'gracemusic');

  console.log('=== Finding "God Will Make A Way" ===');
  const song = await db.collection('songs').findOne({ title: { $regex: 'God Will Make A Way', $options: 'i' } });
  if (song) {
    console.log(`Found: ID = ${song._id.toString()}, Title = "${song.title}", Status = ${song.status}`);
  } else {
    console.log('Not found');
  }

  await client.close();
}

check().catch(console.error);
