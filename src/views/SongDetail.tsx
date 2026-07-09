import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SongDisplay from '@/components/songs/SongDisplay';
import AddToGroupButton from '@/components/groups/AddToGroupButton';
import PdfPreviewModal from '@/components/songs/PdfPreviewModal';
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Song } from '@/lib/types';
import { getTransposedKeyName } from '@/lib/chordUtils';
import { detectKey } from '@/lib/keyDetection';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, History, FileText, Edit2 } from 'lucide-react';
import CopyToOrgButton from '@/components/organizations/CopyToOrgButton';

const SongDetail = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { getSong, deleteSong, fetchSongDetails } = useSongs();
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const song = useMemo(() => id ? getSong(id) : undefined, [id, getSong]);
  
  const [transposition, setTransposition] = useState(0);
  const [useFlats, setUseFlats] = useState(false);
  const [showChords, setShowChords] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  useEffect(() => {
    if (id) {
      const existing = getSong(id);
      if (!existing && !song) {
        // Just wait until it populates, or redirect if really invalid
        // Let's rely on fetchSongDetails filling the void
      }
      fetchSongDetails(id).catch(() => {
        router.replace('/songs');
      });
    }
  }, [id, fetchSongDetails, getSong, router]);

  const canEdit = song && currentUser && (
    currentUser.role === 'super_admin' || 
    currentUser.role === 'editor' ||
    (currentUser.role === 'manager' && song.createdBy === currentUser.id)
  );

  const handleDelete = async () => {
    if (song && window.confirm('Are you sure you want to delete this song?')) {
      try {
        await deleteSong(song.id);
        router.push('/songs');
      } catch (error) {
        console.error('Failed to delete song:', error);
      }
    }
  };

  const handleOpenPdfPreview = () => {
    if (!song) return;
    setShowPdfPreview(true);
  };

  if (!song) return null;
  if (!song.lyrics) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center">
        <p className="text-muted-foreground animate-pulse">Loading lyrics...</p>
      </div>
    );
  }

  const originalKey = song.originalKey || detectKey(song.lyrics);
  const currentKey = getTransposedKeyName(originalKey, transposition);

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Header / Banner Area */}
      <div className="bg-gradient-to-b from-primary/10 via-primary/5 to-zinc-950 pt-20 md:pt-28 pb-6">
        <div className="container mx-auto px-4">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold mb-6 px-3 py-1 rounded-full transition-all hover:scale-105"
            onClick={() => router.push('/songs')}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Button>

          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/20 text-primary border-none uppercase tracking-widest text-[10px] font-black px-3 py-1 rounded-full">
                  SONG
                </Badge>
              </div>
              
              <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-md">
                {song.title}
              </h1>

              <div className="flex items-center gap-3 text-sm text-zinc-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Updated {new Date(song.updatedAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="container mx-auto px-4 flex items-center justify-end gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {currentUser && (
              <>
                <AddToGroupButton songId={song.id} songTitle={song.title} showText={true} />
                <CopyToOrgButton
                  songId={song.id}
                  songTitle={song.title}
                  songOrgId={song.organizationId}
                  showText={true}
                  variant="default"
                />
              </>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
              onClick={handleOpenPdfPreview}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </Button>
            
            {canEdit && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 rounded-full border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:text-white transition-all font-medium"
                  onClick={() => router.push(`/songs/edit?id=${song.id}`)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="gap-2 rounded-full font-medium"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-8 py-8">
        <SongDisplay 
          song={song} 
          fontSize={fontSize}
          transposition={transposition}
          useFlats={useFlats}
          onTransposeUp={() => setTransposition(Math.min(transposition + 1, 11))}
          onTransposeDown={() => setTransposition(Math.max(transposition - 1, -11))}
          onResetTransposition={() => setTransposition(0)}
          onFontSizeChange={(delta) => setFontSize(f => Math.min(24, Math.max(12, f + delta)))}
          onUseFlatsChange={setUseFlats}
        />
      </div>

      {/* PDF Preview Modal */}
      {song && (
        <PdfPreviewModal
          open={showPdfPreview}
          onOpenChange={setShowPdfPreview}
          songs={[song]}
          initialTranspositions={{ [song.id]: transposition }}
          initialUseFlats={{ [song.id]: useFlats }}
          initialFontSize={fontSize}
        />
      )}
    </div>
  );
};

export default SongDetail;

