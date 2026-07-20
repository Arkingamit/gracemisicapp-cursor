const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in .env.local');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'gracemusic');
  
  const userId = '69e2a5e797915847f55a7532';
  const orgs = await db.collection('organizations').find({
    $or: [
      { members: userId },
      { managerIds: userId },
      { managerId: userId }
    ]
  }).toArray();
  const userOrgIds = orgs.map(o => o._id.toString());
  console.log('userOrgIds:', userOrgIds);
  
  const query = {
    $or: [
      { members: userId },
      { organizationId: { $in: userOrgIds } }
    ]
  };
  
  const groups = await db.collection('groups').find(query).toArray();
  console.log('groups found:', groups.length);
  await client.close();
}
run().catch(console.dir);
