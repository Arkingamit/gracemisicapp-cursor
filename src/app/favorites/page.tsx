
"use client";

import React from 'react';
import { usePlaylists } from '@/contexts/PlaylistContext';
import { useSongs } from '@/contexts/SongContext';
import { Button } from '@/components/ui/button';
import { Heart, Music, ChevronRight, ListMusic, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import LikeButton from '@/components/songs/LikeButton';
import AddToPlaylistDialog from '@/components/playlists/AddToPlaylistDialog';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

export default function FavoritesPage() {
  const { favoriteIds, loading } = usePlaylists();
  const { songs } = useSongs();
  const router = useRouter();

  const favoriteSongs = songs.filter(s => favoriteIds.includes(s.id));

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-zinc-950 pt-20 md:pt-28 pb-6">
        <div className="container mx-auto px-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-0 h-auto text-zinc-400 hover:text-white hover:bg-transparent flex items-center gap-1 text-sm font-medium mb-6"
            onClick={() => router.push('/songs')}
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Songs
          </Button>

          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="bg-primary/20 text-primary border-none uppercase tracking-widest text-[10px] font-black px-3 py-1 rounded-full w-fit">
                Personal Library
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md">
                Favorite Songs
              </h1>
              <p className="text-sm text-zinc-400 font-medium">
                All the songs you've hearted in one place.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">

      {loading && favoriteSongs.length === 0 ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 rounded-lg bg-zinc-900/40 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : favoriteSongs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/40 rounded-3xl border border-zinc-800 backdrop-blur-xl">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
            <Heart className="w-10 h-10 text-red-500/50" />
          </div>
          <h3 className="text-2xl font-bold tracking-tight">Your heart is empty</h3>
          <p className="text-muted-foreground mt-3 max-w-xs text-center px-4">
            Start liking songs to build your personal library of favorites!
          </p>
          <Button asChild variant="outline" className="mt-8 px-8 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white">
            <Link href="/songs">Browse Songs</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {favoriteSongs.map((song) => (
            <div 
              key={song.id} 
              className="group flex items-center justify-between p-3 rounded-2xl bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800 hover:border-primary/30 transition-all duration-300"
            >
              <Link href={`/songs/view?id=${song.id}`} className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <Music className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-1">
                    {song.title}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {song.artist}
                  </p>
                </div>
                <div className="hidden sm:block ml-4">
                  <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest py-1 bg-zinc-800 border-none text-zinc-300 rounded-full px-3">
                    {song.genre.join(', ')}
                  </Badge>
                </div>
              </Link>
              
              <div className="flex items-center gap-1 sm:gap-2 pl-4">
                <AddToPlaylistDialog 
                  songId={song.id} 
                  trigger={
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/20 hover:text-primary">
                      <ListMusic className="w-4 h-4" />
                    </Button>
                  }
                />
                <LikeButton songId={song.id} className="h-9 w-9 rounded-full hover:bg-red-500/10" />
                <Button asChild size="icon" className="h-9 w-9 rounded-full bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg shadow-primary/20 ml-2">
                  <Link href={`/songs/view?id=${song.id}`}>
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

