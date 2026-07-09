import { NextRequest } from 'next/server';
import { GenreModel } from '@/server/models/genre';
import { UserModel } from '@/server/models/user';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    // Seed default genres if the collection is empty
    await GenreModel.seedDefaults();
    
    // List all genres
    const genres = await GenreModel.list();
    return Response.json(genres);
  } catch (error) {
    console.error('Fetch genres error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if requester is super_admin
    const requester = await UserModel.findById(decoded.userId);
    if (!requester || requester.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return Response.json({ error: 'Genre name is required' }, { status: 400 });
    }

    const newGenre = await GenreModel.create(name.trim());
    return Response.json(newGenre, { status: 201 });
  } catch (error: any) {
    console.error('Create genre error:', error);
    if (error.message === 'Genre already exists') {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

