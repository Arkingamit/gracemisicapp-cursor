import { MongoClient, Collection, Document } from 'mongodb';

// Connection URIs from environment variables
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "gracemusic";

// Atlas backup configuration
const atlasUri = process.env.MONGODB_ATLAS_URI;

if (!uri && process.env.NODE_ENV === 'production') {
  throw new Error("MONGODB_URI is not defined. Please set it in your environment variables.");
}

const connectionUri = uri || "mongodb://localhost:27017";

// Global cache for serverless (Next.js API routes create new instances per request)
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _atlasClientPromise?: Promise<MongoClient | null>;
};

let clientPromise: Promise<MongoClient>;
let atlasClientPromise: Promise<MongoClient | null>;

if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable to preserve the client across HMR
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(connectionUri);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
  
  if (!globalWithMongo._atlasClientPromise) {
    if (atlasUri) {
      const atlasClient = new MongoClient(atlasUri);
      globalWithMongo._atlasClientPromise = atlasClient.connect().catch(err => {
        console.error("Failed to connect to MongoDB Atlas Backup:", err);
        return null;
      });
    } else {
      globalWithMongo._atlasClientPromise = Promise.resolve(null);
    }
  }
  atlasClientPromise = globalWithMongo._atlasClientPromise;
} else {
  // In production, create a new client for each instance
  const client = new MongoClient(connectionUri);
  clientPromise = client.connect();
  
  if (atlasUri) {
    const atlasClient = new MongoClient(atlasUri);
    atlasClientPromise = atlasClient.connect().catch(err => {
      console.error("Failed to connect to MongoDB Atlas Backup:", err);
      return null;
    });
  } else {
    atlasClientPromise = Promise.resolve(null);
  }
}

export async function connectToDatabase() {
  const client = await clientPromise;
  const db = client.db(dbName);
  return db;
}

export async function connectToAtlasDatabase() {
  const client = await atlasClientPromise;
  if (!client) return null;
  const db = client.db(dbName);
  return db;
}

export async function disconnectFromDatabase() {
  const client = await clientPromise;
  await client.close();
  const atlasClient = await atlasClientPromise;
  if (atlasClient) await atlasClient.close();
}

/**
 * Wraps a collection in a Proxy that intercepts write operations
 * and asynchronously mirrors them to the Atlas backup collection.
 */
function createDualWriteProxy<T extends Document>(localCollection: Collection<T>, atlasCollection: Collection<T> | null): Collection<T> {
  if (!atlasCollection) return localCollection;

  // List of write methods we want to mirror
  const writeMethods = [
    'insertOne', 'insertMany', 
    'updateOne', 'updateMany', 
    'replaceOne', 
    'deleteOne', 'deleteMany', 
    'findOneAndReplace', 'findOneAndUpdate', 'findOneAndDelete',
    'bulkWrite'
  ];

  return new Proxy(localCollection, {
    get(target, prop, receiver) {
      const originalMethod = target[prop as keyof typeof target];
      
      if (typeof originalMethod === 'function' && typeof prop === 'string' && writeMethods.includes(prop)) {
        return async (...args: any[]) => {
          // 1. Execute on the local database (primary source of truth)
          // We await this so the user's request continues normally
          const result = await (originalMethod as Function).apply(target, args);
          
          // 2. Fire and forget to the Atlas database (backup)
          // We don't await this, and we catch errors so it never breaks the local app
          try {
            const atlasMethod = atlasCollection[prop as keyof typeof atlasCollection] as Function;
            atlasMethod.apply(atlasCollection, args).catch((err: any) => {
              console.error(`[Atlas Backup] Failed to mirror ${prop} on collection ${localCollection.collectionName}:`, err);
            });
          } catch (e) {
            console.error(`[Atlas Backup] Error initiating mirror for ${prop} on collection ${localCollection.collectionName}:`, e);
          }

          return result;
        };
      }

      // For all other methods (like find, count, aggregate), just pass through to local
      return Reflect.get(target, prop, receiver);
    }
  });
}

export const getCollection = async (collectionName: string) => {
  const localDb = await connectToDatabase();
  const localCollection = localDb.collection(collectionName);
  
  const atlasDb = await connectToAtlasDatabase();
  const atlasCollection = atlasDb ? atlasDb.collection(collectionName) : null;
  
  return createDualWriteProxy(localCollection, atlasCollection);
};

export default clientPromise;
