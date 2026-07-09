import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/server/db/connection';

export async function GET(request: NextRequest) {
  const diagnostics = {
    env: {
      MONGODB_URI: !!process.env.MONGODB_URI,
      MONGODB_DB_NAME: !!process.env.MONGODB_DB_NAME,
      JWT_SECRET: !!process.env.JWT_SECRET,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "not set",
      NODE_ENV: process.env.NODE_ENV,
    },
    mongodb: "unknown",
    error: null as string | null,
  };

  try {
    const db = await connectToDatabase();
    const collections = await db.listCollections().toArray();
    diagnostics.mongodb = "connected";
    (diagnostics as any).collections = collections.map(c => c.name);
  } catch (err: any) {
    diagnostics.mongodb = "failed";
    diagnostics.error = err.message || String(err);
  }

  return NextResponse.json(diagnostics);
}

