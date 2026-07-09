
"use client";

import React, { useState, useMemo } from 'react';
import { ArrowRightLeft, Check, Loader2, Music, Plus, Users, Search, CheckSquare, Square, MinusSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/contexts/groups';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useSongs } from '@/contexts/SongContext';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Group, Organization } from '@/lib/types';

interface TransferToSongSetDialogProps {
  /** Song IDs currently in the collection */
  songIds: string[];
  /** Name of the collection for display */
  collectionName: string;
  /** Optional custom trigger element */
  trigger?: React.ReactNode;
}

const TransferToSongSetDialog: React.FC<TransferToSongSetDialogProps> = ({
  songIds,
  collectionName,
  trigger,
}) => {
  const { currentUser } = useAuth();
  const { groups, addSongToGroup, createGroup, refreshGroups } = useGroups();
  const { organizations } = useOrganizations();
  const { songs: allSongs } = useSongs();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select-songs' | 'select-group'>('select-songs');
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [songSearchTerm, setSongSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // "Create new song set" state — tracks which org is being created for
  const [creatingForOrgId, setCreatingForOrgId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Build song info map for display
  const songInfoMap = useMemo(() => {
    const map: Record<string, { title: string; artist: string }> = {};
    allSongs.forEach(s => {
      map[s.id] = { title: s.title || 'Untitled', artist: s.artist || 'Unknown' };
    });
    return map;
  }, [allSongs]);

  // Filter songs by search term
  const filteredSongIds = useMemo(() => {
    if (!songSearchTerm.trim()) return songIds;
    const term = songSearchTerm.toLowerCase();
    return songIds.filter(id => {
      const info = songInfoMap[id];
      if (!info) return false;
      return info.title.toLowerCase().includes(term) || info.artist.toLowerCase().includes(term);
    });
  }, [songIds, songSearchTerm, songInfoMap]);

  // Filter organizations where the current user is a manager or editor
  const eligibleOrgs = organizations.filter(org => {
    if (!currentUser) return false;
    return (
      org.managerIds?.includes(currentUser.id) ||
      org.editorIds?.includes(currentUser.id) ||
      org.createdBy === currentUser.id
    );
  });

  // Build map of org → groups that the user has access to
  const orgGroupsMap: Record<string, Group[]> = {};
  eligibleOrgs.forEach(org => {
    orgGroupsMap[org.id] = groups.filter(group =>
      group.organizationId === org.id
    );
  });

  // Count how many of the SELECTED songs would be new in the selected group
  const getNewSongsCount = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return selectedSongIds.size;
    return Array.from(selectedSongIds).filter(id => !group.songs.includes(id)).length;
  };

  // Toggle individual song selection
  const toggleSong = (id: string) => {
    setSelectedSongIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all filtered songs
  const toggleAllFiltered = () => {
    const allFilteredSelected = filteredSongIds.every(id => selectedSongIds.has(id));
    setSelectedSongIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredSongIds.forEach(id => next.delete(id));
      } else {
        filteredSongIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const allFilteredSelected = filteredSongIds.length > 0 && filteredSongIds.every(id => selectedSongIds.has(id));
  const someFilteredSelected = filteredSongIds.some(id => selectedSongIds.has(id));

  const handleCreateGroup = async (orgId: string) => {
    if (!newGroupName.trim()) return;

    setIsCreatingGroup(true);
    try {
      const newGroupId = await createGroup({
        name: newGroupName.trim(),
        organizationId: orgId,
      });

      // Refresh groups to get the new group in the list
      await refreshGroups();

      // Auto-select the newly created group
      setSelectedGroupId(newGroupId);
      setCreatingForOrgId(null);
      setNewGroupName('');

      toast({
        title: 'Song Set created!',
        description: `"${newGroupName.trim()}" has been created. Click Transfer to add songs.`,
      });
    } catch (error) {
      console.error('Failed to create group:', error);
      // Toast is already shown by createGroup action
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedGroupId || selectedSongIds.size === 0) return;

    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return;

    // Only add songs that aren't already in the group
    const newSongIds = Array.from(selectedSongIds).filter(id => !group.songs.includes(id));

    if (newSongIds.length === 0) {
      toast({
        title: 'Already transferred',
        description: `All selected songs are already in "${group.name}".`,
      });
      setOpen(false);
      return;
    }

    setIsTransferring(true);
    try {
      for (const songId of newSongIds) {
        await addSongToGroup(selectedGroupId, songId);
      }

      toast({
        title: 'Transfer complete!',
        description: `${newSongIds.length} ${newSongIds.length === 1 ? 'song' : 'songs'} from "${collectionName}" added to "${group.name}".`,
      });

      setOpen(false);
      setSelectedGroupId(null);
      setSelectedSongIds(new Set());
      setStep('select-songs');
    } catch (error) {
      console.error('Transfer failed:', error);
      toast({
        title: 'Transfer failed',
        description: error instanceof Error ? error.message : 'Could not transfer songs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setSelectedGroupId(null);
      setCreatingForOrgId(null);
      setNewGroupName('');
      setSelectedSongIds(new Set());
      setSongSearchTerm('');
      setStep('select-songs');
    }
  };

  // Don't render the button at all if user isn't a manager/editor of any org
  if (eligibleOrgs.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Transfer to Song Set
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'select-songs' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                Select Songs to Transfer
              </DialogTitle>
              <DialogDescription>
                Choose which songs from
                <span className="font-semibold text-foreground"> "{collectionName}"</span> you want to transfer.
                <span className="text-primary font-medium ml-1">
                  {selectedSongIds.size} of {songIds.length} selected
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              {/* Search & Select All */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search songs..."
                    value={songSearchTerm}
                    onChange={(e) => setSongSearchTerm(e.target.value)}
                    className="h-8 text-xs pl-8 bg-transparent border-white/10"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 shrink-0"
                  onClick={toggleAllFiltered}
                >
                  {allFilteredSelected ? (
                    <MinusSquare className="w-3.5 h-3.5" />
                  ) : (
                    <CheckSquare className="w-3.5 h-3.5" />
                  )}
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Song List */}
              <ScrollArea className="h-[300px] pr-2">
                <div className="space-y-1">
                  {filteredSongIds.map(id => {
                    const info = songInfoMap[id];
                    const isSelected = selectedSongIds.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleSong(id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                          isSelected
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-secondary/50 border border-transparent'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <div className="font-medium truncate">{info?.title || 'Unknown Song'}</div>
                          <div className="text-xs text-muted-foreground truncate">{info?.artist || ''}</div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredSongIds.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm italic">
                      {songSearchTerm ? 'No songs match your search.' : 'No songs in this collection.'}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep('select-group')}
                disabled={selectedSongIds.size === 0}
                className="gap-2"
              >
                Next: Choose Song Set
                <ArrowRightLeft className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Choose Destination Song Set
              </DialogTitle>
              <DialogDescription>
                Transferring
                <span className="font-semibold text-primary"> {selectedSongIds.size} {selectedSongIds.size === 1 ? 'song' : 'songs'}</span> from
                <span className="font-semibold text-foreground"> "{collectionName}"</span>.
                Duplicates will be skipped automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <ScrollArea className="h-[350px] pr-4">
                <Accordion type="multiple" defaultValue={eligibleOrgs.map(o => o.id)} className="w-full">
                  {eligibleOrgs.map((org: Organization) => (
                    <AccordionItem key={org.id} value={org.id}>
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          <span>{org.name}</span>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {org.managerIds?.includes(currentUser?.id || '') ? 'Manager' : 'Editor'}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {/* Existing groups */}
                          {orgGroupsMap[org.id]?.map((group: Group) => {
                            const isSelected = selectedGroupId === group.id;
                            const newCount = getNewSongsCount(group.id);
                            return (
                              <button
                                key={group.id}
                                onClick={() => setSelectedGroupId(isSelected ? null : group.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-primary/15 border border-primary/30 text-primary'
                                    : 'hover:bg-secondary/50 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isSelected ? (
                                    <Check className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Music className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span className="font-medium">{group.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {newCount === 0
                                    ? 'All songs exist'
                                    : `${newCount} new`}
                                </span>
                              </button>
                            );
                          })}

                          {/* Create new song set */}
                          {creatingForOrgId === org.id ? (
                            <div className="flex gap-2 px-1 pt-2 animate-in slide-in-from-top-2 duration-200">
                              <Input
                                placeholder="New song set name..."
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCreateGroup(org.id);
                                  if (e.key === 'Escape') {
                                    setCreatingForOrgId(null);
                                    setNewGroupName('');
                                  }
                                }}
                                className="h-9 text-sm"
                                autoFocus
                                disabled={isCreatingGroup}
                              />
                              <Button
                                size="sm"
                                className="h-9 shrink-0"
                                onClick={() => handleCreateGroup(org.id)}
                                disabled={!newGroupName.trim() || isCreatingGroup}
                              >
                                {isCreatingGroup ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Create'
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 shrink-0"
                                onClick={() => {
                                  setCreatingForOrgId(null);
                                  setNewGroupName('');
                                }}
                                disabled={isCreatingGroup}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setCreatingForOrgId(org.id);
                                setNewGroupName('');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed border-muted-foreground/20 hover:border-primary/30 transition-all duration-200 mt-1"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Create New Song Set</span>
                            </button>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('select-songs')} disabled={isTransferring} className="mr-auto">
                ← Back
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isTransferring}>
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={!selectedGroupId || isTransferring || (selectedGroupId ? getNewSongsCount(selectedGroupId) === 0 : true)}
                className="gap-2"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transferring...
                  </>
                ) : selectedGroupId ? (
                  `Transfer ${getNewSongsCount(selectedGroupId)} ${getNewSongsCount(selectedGroupId) === 1 ? 'Song' : 'Songs'}`
                ) : (
                  'Select a Song Set'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TransferToSongSetDialog;

