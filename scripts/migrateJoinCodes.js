require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const generateJoinCode = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required. Make sure it is in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const dbName = process.env.MONGODB_DB_NAME || "gracemusic";
    const db = client.db(dbName);
    const organizations = db.collection('organizations');
    
    const orgsToUpdate = await organizations.find({ 
      $or: [
        { joinCode: { $exists: false } },
        { joinCode: null },
        { joinCode: '' }
      ]
    }).toArray();
    
    console.log(`Found ${orgsToUpdate.length} organizations to update.`);
    
    for (const org of orgsToUpdate) {
      let joinCode = '';
      let isUnique = false;
      while (!isUnique) {
        joinCode = generateJoinCode();
        const existing = await organizations.findOne({ joinCode });
        if (!existing) {
          isUnique = true;
        }
      }
      
      await organizations.updateOne(
        { _id: org._id },
        { $set: { joinCode } }
      );
      console.log(`Updated organization ${org.name} with joinCode: ${joinCode}`);
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrate();
