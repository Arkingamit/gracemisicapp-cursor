import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/server/db/connection';
import { enforceRateLimit } from '@/server/rateLimit';
import { getAuthUser } from '@/lib/auth';

// GET /api/diag — infrastructure diagnostics. Exposes environment/collection
// info, so it is restricted to super admins; details are logged server-side.
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { policy: 'public', bucket: 'diag' });
  if (limited) return limited;

  const auth = getAuthUser(request);
  if (!auth || auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

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
  } catch (err) {
    console.error('Diag: MongoDB connection failed:', err);
    diagnostics.mongodb = "failed";
    diagnostics.error = 'Database connection failed. Check server logs for details.';
  }

  return NextResponse.json(diagnostics);
}
