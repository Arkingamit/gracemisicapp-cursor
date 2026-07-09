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
        { error: 'Unauthorized: Only super admins can copy songs to the global library' },
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
    
    const copiedSong = await SongModel.copyToGlobal(id);

    return NextResponse.json({ 
      message: 'Song successfully copied to global library',
      song: copiedSong
    });
  } catch (error) {
    console.error('Error copying song global:', error);
    return NextResponse.json(
      { error: 'Failed to copy song to global' },
      { status: 500 }
    );
  }
}
