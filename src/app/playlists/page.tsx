"use client";

import React, { useMemo, useState } from 'react';
import { usePlaylists } from '@/contexts/PlaylistContext';
import { useSongs } from '@/contexts/SongContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music, Trash2, ChevronRight, ChevronLeft, ListMusic, Plus, ArrowRightLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import TransferToSongSetDialog from '@/components/groups/TransferToSongSetDialog';
import PdfPreviewModal from '@/components/songs/PdfPreviewModal';
import { DEFAULT_PAGE_SIZE, getPageNumbers } from '@/lib/pagination';

export default function PlaylistsPage() {
  const { playlists, deletePlaylist, createPlaylist, loading } = usePlaylists();
  const { songs } = useSongs();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [pdfPlaylistId, setPdfPlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const getPlaylistSongs = (songIds: string[]) => {
    return songs.filter(s => songIds.includes(s.id));
  };

  const totalPages = Math.max(1, Math.ceil(playlists.length / DEFAULT_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPlaylists = useMemo(
    () => playlists.slice((safePage - 1) * DEFAULT_PAGE_SIZE, safePage * DEFAULT_PAGE_SIZE),
    [playlists, safePage]
  );

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-zinc-950 pt-20 md:pt-28 pb-6">
        <div className="container mx-auto px-4 max-w-5xl">
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-0 h-auto text-zinc-400 hover:text-white hover:bg-transparent flex items-center gap-1 text-sm font-medium mb-6"
            onClick={() => router.push('/songs')}
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Songs
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3">
              <Badge variant="outline" className="bg-primary/20 text-primary border-none uppercase tracking-widest text-[10px] font-black px-3 py-1 rounded-full w-fit">
                LIBRARY
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md">
                Your Collections
              </h1>
              <p className="text-sm text-zinc-400 font-medium">
                Organize your favorite songs into custom collections.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {isCreating ? (
                <div className="flex gap-2 animate-in slide-in-from-right-4 duration-300">
                  <Input 
                    placeholder="Collection name..." 
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="h-9 w-40 sm:w-48 bg-zinc-900 border-zinc-800 text-white rounded-full px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    onClick={handleCreate}
                    className="rounded-full bg-primary hover:bg-primary/80 font-medium h-9 px-4 text-primary-foreground"
                  >
                    Create
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setIsCreating(false)}
                    className="rounded-full text-zinc-400 hover:text-white hover:bg-transparent font-medium"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => setIsCreating(true)} 
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium h-9 px-4"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Collection
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {loading && playlists.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-48 rounded-xl bg-zinc-900/40 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <Card className="border-dashed border-2 border-zinc-850 bg-transparent rounded-3xl">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <ListMusic className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">No collections yet</h3>
              <p className="text-muted-foreground mt-2 max-w-sm">
                Collections help you group songs for different occasions or classes. Try creating one!
              </p>
              <Button variant="outline" className="mt-6 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800" onClick={() => setIsCreating(true)}>
                Create your first collection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedPlaylists.map((playlist) => {
                const playlistSongs = getPlaylistSongs(playlist.songs);
                return (
                  <Card key={playlist.id} className="group overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 bg-zinc-900/40 backdrop-blur-xl border-zinc-800 rounded-2xl">
                    <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-1">
                          {playlist.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 text-zinc-400">
                          <Music className="w-3.5 h-3.5 text-zinc-500" />
                          {playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}
                        </CardDescription>
                      </div>
                      
                      <div className="flex items-center gap-0.5">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-full">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm" className="bg-zinc-900 border border-zinc-800 text-white">
                            <AlertDialogHeader>
                              <AlertDialogMedia className="bg-red-950/60 text-red-400">
                                <Trash2 />
                              </AlertDialogMedia>
                              <AlertDialogTitle>Delete Collection</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">
                                Are you sure you want to delete <span className="font-bold text-white">"{playlist.name}"</span>? 
                                This collection will be removed but the songs will remain in your library.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-red-500 hover:bg-red-600 text-white"
                                onClick={() => deletePlaylist(playlist.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <TransferToSongSetDialog
                          songIds={playlist.songs}
                          collectionName={playlist.name}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-primary hover:bg-primary/10 rounded-full" title="Transfer to Song Set">
                              <ArrowRightLeft className="w-4 h-4" />
                            </Button>
                          }
                        />

                        {playlistSongs.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full"
                            title="Export as PDF"
                            onClick={() => setPdfPlaylistId(playlist.id)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardFooter className="pt-2">
                      <Button asChild variant="outline" className="w-full text-xs h-8 rounded-full border-zinc-850 bg-zinc-900/60 text-zinc-100 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 font-medium">
                        <Link href={`/playlists/view?id=${playlist.id}`} className="flex items-center justify-center">
                          Open Collection
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      className={`cursor-pointer select-none ${safePage <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                      onClick={() => goToPage(safePage - 1)}
                    />
                  </PaginationItem>
                  {getPageNumbers(safePage, totalPages).map((p, idx) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`e-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          className="cursor-pointer select-none"
                          isActive={p === safePage}
                          onClick={() => goToPage(p)}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      className={`cursor-pointer select-none ${safePage >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                      onClick={() => goToPage(safePage + 1)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>

      {pdfPlaylistId && (() => {
        const pl = playlists.find(p => p.id === pdfPlaylistId);
        const pdfSongs = pl ? getPlaylistSongs(pl.songs) : [];
        return pdfSongs.length > 0 ? (
          <PdfPreviewModal
            open={true}
            onOpenChange={(v) => { if (!v) setPdfPlaylistId(null); }}
            songs={pdfSongs}
            title={pl?.name || 'Collection'}
            initialFontSize={14}
          />
        ) : null;
      })()}
    </div>
  );
}
