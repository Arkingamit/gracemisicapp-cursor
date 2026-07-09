const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function restore() {
  const uri = process.env.MONGODB_URI;
  const sourceDbName = process.env.MONGODB_DB_NAME;
  const targetDbName = 'gracemusic';
  
  console.log(`Connecting to MongoDB Atlas...`);
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log(`Connected successfully.`);
    console.log(`Source DB: ${sourceDbName}`);
    console.log(`Target DB: ${targetDbName}`);
    
    const sourceDb = client.db(sourceDbName);
    const targetDb = client.db(targetDbName);
    
    const collections = await sourceDb.listCollections().toArray();
    
    console.log(`Found ${collections.length} collections. Starting copy...`);
    
    for (const collInfo of collections) {
      if (collInfo.type === 'view') continue;
      
      const collName = collInfo.name;
      const sourceColl = sourceDb.collection(collName);
      const targetColl = targetDb.collection(collName);
      
      const docs = await sourceColl.find({}).toArray();
      
      if (docs.length > 0) {
        // Clear target collection if it exists
        await targetColl.deleteMany({});
        // Insert docs
        await targetColl.insertMany(docs);
        console.log(`[SUCCESS] Copied ${docs.length} documents to collection: ${collName}`);
      } else {
        console.log(`[SKIPPED] Collection ${collName} is empty.`);
      }
    }
    
    console.log(`\n✅ RESTORE COMPLETE!`);
    console.log(`Your database was successfully copied to a new database named: ${targetDbName}`);
  } catch (error) {
    console.error('Error during backup:', error);
  } finally {
    await client.close();
  }
}

restore();
