
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePlaylists } from '@/contexts/PlaylistContext';
import { useSongs } from '@/contexts/SongContext';
import { Playlist, Song } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  Music,
  History,
  ArrowRightLeft,
  FileText,
  Edit2
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import TransferToSongSetDialog from '@/components/TransferToSongSetDialog';
import PdfPreviewModal from '@/components/PdfPreviewModal';
import CollectionSongList from '@/components/CollectionSongList';

function PlaylistDetailContent() {
  const searchParams = useSearchParams();
  const playlistId = searchParams.get('id');
  const router = useRouter();
  const { playlists, removeSongFromPlaylist, updatePlaylist, loading } = usePlaylists();
  const { songs } = useSongs();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  useEffect(() => {
    if (!playlistId) return;
    const found = playlists.find(p => p.id === playlistId);
    if (found) {
      setPlaylist(found);
    } else if (!loading && playlists.length > 0) {
      // If not found and not loading, might be an invalid ID or deleted
      // router.push('/playlists');
    }
  }, [playlistId, playlists, loading]);

  if (loading && !playlist) {
    return <div className="container mx-auto px-4 py-20 text-center">Loading collection...</div>;
  }

  if (!playlist) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Collection not found</h2>
        <Button asChild variant="link" className="mt-4">
          <Link href="/playlists">Back to all collections</Link>
        </Button>
      </div>
    );
  }

  const playlistSongs = songs.filter(s => playlist.songs.includes(s.id));

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-zinc-950 pt-8 pb-6">
        <div className="container mx-auto px-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-0 h-auto text-zinc-400 hover:text-white hover:bg-transparent flex items-center gap-1 text-sm font-medium mb-6"
            onClick={() => router.push('/playlists')}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 flex-1">
              <Badge variant="outline" className="bg-primary/20 text-primary border-none uppercase tracking-widest text-[10px] font-black px-3 py-1 rounded-full w-fit">
                Personal Collection
              </Badge>
              {isEditingName ? (
                <form 
                  className="flex items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (editNameValue.trim() && editNameValue !== playlist.name) {
                      await updatePlaylist(playlist.id, editNameValue.trim());
                    }
                    setIsEditingName(false);
                  }}
                >
                  <input 
                    autoFocus
                    className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md bg-transparent border-b-2 border-primary/50 focus:border-primary outline-none focus:ring-0 px-0 py-0 w-full"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={async () => {
                      if (editNameValue.trim() && editNameValue !== playlist.name) {
                        await updatePlaylist(playlist.id, editNameValue.trim());
                      }
                      setIsEditingName(false);
                    }}
                  />
                </form>
              ) : (
                <div 
                  className="flex items-center gap-3 group/title w-fit cursor-pointer"
                  onClick={() => {
                    setEditNameValue(playlist.name);
                    setIsEditingName(true);
                  }}
                >
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md">
                    {playlist.name}
                  </h1>
                  <Edit2 className="w-4 h-4 text-zinc-500 hover:text-white transition-colors flex-shrink-0" />
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-zinc-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Updated {new Date(playlist.updatedAt).toLocaleDateString()}
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                <span>{playlistSongs.length} songs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="container mx-auto px-4 flex items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            {/* Transfer to Song Set button */}
            {playlistSongs.length > 0 && (
              <TransferToSongSetDialog
                songIds={playlist.songs}
                collectionName={playlist.name}
                trigger={
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer to Song Set</span>
                  </Button>
                }
              />
            )}

            {/* PDF Export button */}
            {playlistSongs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
                onClick={() => setShowPdfPreview(true)}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Songs List — same layout as Song Set */}
      <div className="container mx-auto px-0 sm:px-4 py-8">
        {playlistSongs.length === 0 ? (
          <div className="py-20 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/10 mx-4 sm:mx-0">
            <p className="text-zinc-500 mb-6">This collection is empty.</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/songs">Add some songs</Link>
            </Button>
          </div>
        ) : (
          <CollectionSongList
            songIds={playlist.songs}
            collectionName={playlist.name}
            onRemoveSong={(songId) => removeSongFromPlaylist(playlist.id, songId)}
          />
        )}
      </div>

      {/* PDF Preview Modal */}
      {showPdfPreview && playlistSongs.length > 0 && (
        <PdfPreviewModal
          open={showPdfPreview}
          onOpenChange={setShowPdfPreview}
          songs={playlistSongs}
          title={playlist.name}
          initialFontSize={14}
        />
      )}
    </div>
  );
}

export default function PlaylistDetailPage() {
  return (
    <React.Suspense fallback={<div className="container mx-auto px-4 py-20 text-center text-zinc-400">Loading collection...</div>}>
      <PlaylistDetailContent />
    </React.Suspense>
  );
}

