import { NextResponse, NextRequest } from 'next/server';
import { SongModel } from '@/server/models/song';
import { getAuthUser, authError } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);

    // Only allow super admins to run this endpoint
    if (!auth || auth.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only super admins can transfer songs to the global library' },
        { status: 403 }
      );
    }

    const { id } = await params;
    
    // Make sure the song exists
    const existingSong = await SongModel.findById(id);
    if (!existingSong) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }
    
    // No need to do anything if it's already global
    if (!existingSong.organizationId) {
      return NextResponse.json(
        { message: 'Song is already global', song: existingSong },
        { status: 200 }
      );
    }

    const updatedSong = await SongModel.makeGlobal(id);

    return NextResponse.json({ 
      message: 'Song successfully transferred to global library',
      song: updatedSong
    });
  } catch (error) {
    console.error('Error making song global:', error);
    return NextResponse.json(
      { error: 'Failed to make song global' },
      { status: 500 }
    );
  }
}
