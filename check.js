const { MongoClient } = require('mongodb');
async function run() {
  const uri = 'mongodb+srv://gracemusic:Ashish%40123@gracemusic.hwukmyy.mongodb.net/?appName=gracemusic';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('gracemusic_backup_2026_06_13');
  
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
