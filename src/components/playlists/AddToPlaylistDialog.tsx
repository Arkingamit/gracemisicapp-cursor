
"use client";

import React, { useState } from 'react';
import { Plus, ListPlus, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlaylists } from '@/contexts/PlaylistContext';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';

interface AddToPlaylistDialogProps {
  songId: string;
  trigger?: React.ReactNode;
}

const AddToPlaylistDialog: React.FC<AddToPlaylistDialogProps> = ({ songId, trigger }) => {
  const { playlists, addSongToPlaylist, removeSongFromPlaylist, createPlaylist } = usePlaylists();
  const [open, setOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    const playlist = await createPlaylist(newPlaylistName.trim());
    if (playlist) {
      await addSongToPlaylist(playlist.id, songId);
      setNewPlaylistName('');
      setIsCreating(false);
    }
  };

  const toggleSongInPlaylist = async (playlistId: string, hasSong: boolean) => {
    if (hasSong) {
      await removeSongFromPlaylist(playlistId, songId);
    } else {
      await addSongToPlaylist(playlistId, songId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" title="Add to Collection">
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
          <DialogDescription>
            Choose a collection to add this song to, or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isCreating ? (
            <div className="flex gap-2">
              <Input
                placeholder="New collection name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                autoFocus
              />
              <Button onClick={handleCreateAndAdd} size="sm">Create</Button>
              <Button variant="ghost" onClick={() => setIsCreating(false)} size="sm">Cancel</Button>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full justify-start border-dashed mb-4" 
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Collection
            </Button>
          )}

          <ScrollArea className="h-[200px] mt-2 pr-4">
            <div className="space-y-1">
              {playlists.length === 0 && !isCreating && (
                <p className="text-sm text-center text-muted-foreground py-8">
                  No collections yet. Create one above!
                </p>
              )}
              {playlists.map((playlist) => {
                const hasSong = playlist.songs.includes(songId);
                return (
                  <Button
                    key={playlist.id}
                    variant="ghost"
                    className="w-full justify-between font-normal hover:bg-secondary/50 group"
                    onClick={() => toggleSongInPlaylist(playlist.id, hasSong)}
                  >
                    <div className="flex items-center">
                      <ListPlus className="w-4 h-4 mr-3 text-muted-foreground group-hover:text-primary" />
                      <span>{playlist.name}</span>
                    </div>
                    {hasSong && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddToPlaylistDialog;
