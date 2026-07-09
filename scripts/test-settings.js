const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'gracemusic_backup_2026_06_13');
    const settingsColl = db.collection('settings');
    
    console.log('Attempting to update settings...');
    await settingsColl.updateOne(
      { _id: 'global_settings' },
      { $set: { max_groups_per_user: null, max_custom_songs_per_org: null } },
      { upsert: true }
    );
    console.log('Update successful!');
  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    await client.close();
  }
}
test();
