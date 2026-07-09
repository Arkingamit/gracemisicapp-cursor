require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs');

async function backup() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  
  if (!uri || !dbName) {
    console.error("Missing DB credentials in .env.local");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db(dbName);
    
    const songs = await db.collection('songs').find({}).toArray();
    fs.writeFileSync('C:\\Users\\Arkin\\.gemini\\antigravity-ide\\brain\\49f18fb9-3b8d-45a7-a185-642a5ed63101\\scratch\\songs_backup.json', JSON.stringify(songs, null, 2));
    console.log(`Backed up ${songs.length} songs successfully.`);
  } catch (error) {
    console.error("Error backing up:", error);
  } finally {
    await client.close();
  }
}

backup();
