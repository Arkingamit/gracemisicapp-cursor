
import { MongoClient } from 'mongodb';

// Connection URI from environment variables
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "gracemusic";

if (!uri && process.env.NODE_ENV === 'production') {
  throw new Error("MONGODB_URI is not defined. Please set it in your environment variables.");
}

const connectionUri = uri || "mongodb://localhost:27017";

// Global cache for serverless (Next.js API routes create new instances per request)
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable to preserve the client across HMR
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(connectionUri);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production, create a new client for each instance
  const client = new MongoClient(connectionUri);
  clientPromise = client.connect();
}

export async function connectToDatabase() {
  const client = await clientPromise;
  const db = client.db(dbName);
  return db;
}

export async function disconnectFromDatabase() {
  const client = await clientPromise;
  await client.close();
}

export const getCollection = async (collectionName: string) => {
  const db = await connectToDatabase();
  return db.collection(collectionName);
};

export default clientPromise;
