
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SongForm from '@/components/songs/SongForm';
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import { Song } from '@/lib/types';

const SongEdit = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { getSong, fetchSongDetails } = useSongs();
  const { currentUser } = useAuth();
  const router = useRouter();
  
  const song = useMemo(() => id ? getSong(id) : undefined, [id, getSong]);

  useEffect(() => {
    if (id) {
      fetchSongDetails(id).catch(() => {
        router.replace('/songs');
      });
    }
    // Check if user has permission to edit
    if (id && song && currentUser) {
      if (
        currentUser.role !== 'super_admin' && 
        currentUser.role !== 'editor' &&
        !(currentUser.role === 'manager' && song.createdBy === currentUser.id)
      ) {
        router.replace(`/songs/view?id=${id}`);
      }
    }
  }, [id, song, currentUser, router, getSong]);

  if (!song) return null;
  if (!song.lyrics) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <p className="animate-pulse text-muted-foreground">Loading song data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Edit Song</h1>
      <SongForm 
        song={song} 
        onSuccess={() => router.push(`/songs/view?id=${id}`)} 
      />
    </div>
  );
};

export default SongEdit;
