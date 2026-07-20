// Benchmark: N individual updateOne round trips vs one chunked bulkWrite.
// Uses a throwaway collection; drops it afterwards. Run: node scratch/bench-bulk-writes.js
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('Missing MONGODB_URI'); process.exit(1); }
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(process.env.MONGODB_DB_NAME || 'gracemusic').collection('_bench_bulk_writes');

  const N = 500;
  await col.deleteMany({});
  await col.insertMany(Array.from({ length: N }, (_, i) => ({ idx: i, keywords: [] })));
  const docs = await col.find({}).toArray();

  // Pattern A: one updateOne per document (the old loop)
  let t0 = Date.now();
  for (const doc of docs) {
    await col.updateOne({ _id: doc._id }, { $set: { keywords: ['a', 'b', 'c'] } });
  }
  const loopMs = Date.now() - t0;

  // Pattern B: single chunked bulkWrite (the new code)
  t0 = Date.now();
  const ops = docs.map((doc) => ({
    updateOne: { filter: { _id: doc._id }, update: { $set: { keywords: ['x', 'y', 'z'] } } },
  }));
  for (let i = 0; i < ops.length; i += 500) {
    await col.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  }
  const bulkMs = Date.now() - t0;

  // Pattern C: insertMany vs N insertOne (notifications case)
  await col.deleteMany({});
  t0 = Date.now();
  for (let i = 0; i < N; i++) {
    await col.insertOne({ userId: `u${i}`, title: 't', isRead: false });
  }
  const insertLoopMs = Date.now() - t0;

  await col.deleteMany({});
  t0 = Date.now();
  await col.insertMany(
    Array.from({ length: N }, (_, i) => ({ userId: `u${i}`, title: 't', isRead: false })),
    { ordered: false }
  );
  const insertManyMs = Date.now() - t0;

  await col.drop();
  await client.close();

  console.log(`updates  (${N} docs): loop=${loopMs}ms  bulkWrite=${bulkMs}ms  (${(loopMs / bulkMs).toFixed(1)}x faster)`);
  console.log(`inserts  (${N} docs): loop=${insertLoopMs}ms  insertMany=${insertManyMs}ms  (${(insertLoopMs / insertManyMs).toFixed(1)}x faster)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
