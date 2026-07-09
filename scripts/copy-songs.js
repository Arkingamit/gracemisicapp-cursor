const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function copySongs() {
  const uri = process.env.MONGODB_URI;
  
  // As requested, copy from 12 and paste into 13.
  const sourceDbName = 'gracemusic_backup_2026_06_12';
  const targetDbName = 'gracemusic_backup_2026_06_13';
  const collectionName = 'songs';
  
  console.log(`Connecting to MongoDB Atlas...`);
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log(`Connected successfully.`);
    console.log(`Source DB: ${sourceDbName}`);
    console.log(`Target DB: ${targetDbName}`);
    
    const sourceDb = client.db(sourceDbName);
    const targetDb = client.db(targetDbName);
    
    const sourceColl = sourceDb.collection(collectionName);
    const targetColl = targetDb.collection(collectionName);
    
    console.log(`Fetching songs from source...`);
    const docs = await sourceColl.find({}).toArray();
    
    if (docs.length === 0) {
      console.log(`No songs found in source collection. Exiting.`);
      return;
    }
    
    console.log(`Found ${docs.length} songs in source. Attempting to copy to target...`);
    
    // We use { ordered: false } so that if a song with the same _id already exists in the target,
    // it will just skip it (throw a Duplicate Key error for that specific doc) but continue inserting the rest.
    try {
      const result = await targetColl.insertMany(docs, { ordered: false });
      console.log(`\n✅ SUCCESSFULLY COPIED ${result.insertedCount} new songs!`);
    } catch (error) {
      // If error.code is 11000, it means there were duplicate key errors (which is expected if some songs already exist)
      if (error.code === 11000 || (error.writeErrors && error.writeErrors.some(e => e.code === 11000))) {
        const inserted = error.result?.nInserted || 0;
        console.log(`\n✅ OPERATION FINISHED. Copied ${inserted} new songs.`);
        console.log(`(Note: The remaining ${docs.length - inserted} songs already existed in the target and were kept intact.)`);
      } else {
        console.error('An unexpected error occurred during insertion:', error);
      }
    }
    
  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
}

copySongs();
