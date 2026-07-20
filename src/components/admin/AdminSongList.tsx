
import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Song } from '@/lib/types';
import { useSongs } from '@/contexts/SongContext';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, Globe, Copy, ChevronDown, ChevronRight, Building, Music } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';

interface OrgInfo {
  id: string;
  name: string;
}

interface AdminSongListProps {
  songs: Song[];
  organizations?: OrgInfo[];
}

const AdminSongList = ({ songs, organizations = [] }: AdminSongListProps) => {
  const router = useRouter();
  const { deleteSong, deleteMultipleSongs, makeSongGlobal, copySongToGlobal } = useSongs();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const shiftKeyRef = useRef<boolean>(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeOrgFilter, setActiveOrgFilter] = useState<string | null>(null);
  const [pendingGlobalAction, setPendingGlobalAction] = useState<
    { kind: 'move' | 'copy'; song: Song } | null
  >(null);

  // Build a map of orgId -> orgName
  const orgNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    organizations.forEach(org => {
      map[org.id] = org.name;
    });
    return map;
  }, [organizations]);

  const filteredSongs = songs.filter(song => {
    const titleMatch = song.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const artistMatch = song.artist?.toLowerCase().includes(searchTerm.toLowerCase());
    const genreMatch = Array.isArray(song.genre) && song.genre.some(g => 
      typeof g === 'string' && g.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return titleMatch || artistMatch || genreMatch;
  });

  // Group songs by category: Global vs per-organization
  const groupedSongs = useMemo(() => {
    const globalSongs: Song[] = [];
    const orgSongs: Record<string, Song[]> = {};

    filteredSongs.forEach(song => {
      if (!song.organizationId) {
        globalSongs.push(song);
      } else {
        if (!orgSongs[song.organizationId]) {
          orgSongs[song.organizationId] = [];
        }
        orgSongs[song.organizationId].push(song);
      }
    });

    return { globalSongs, orgSongs };
  }, [filteredSongs]);

  // Build ordered sections
  const sections = useMemo(() => {
    const result: { key: string; label: string; icon: 'global' | 'org'; songs: Song[] }[] = [];

    // Global songs first
    result.push({
      key: '__global__',
      label: 'Global Songs',
      icon: 'global',
      songs: groupedSongs.globalSongs,
    });

    // Then each organization
    Object.entries(groupedSongs.orgSongs).forEach(([orgId, orgSongList]) => {
      result.push({
        key: orgId,
        label: orgNameMap[orgId] || `Organization (${orgId.slice(0, 8)}...)`,
        icon: 'org',
        songs: orgSongList,
      });
    });

    return result;
  }, [groupedSongs, orgNameMap]);

  const filteredSections = useMemo(() => {
    if (!activeOrgFilter) return sections;
    return sections.filter(s => s.key === activeOrgFilter);
  }, [sections, activeOrgFilter]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = async (song: Song) => {
    setSongToDelete(song);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!songToDelete) return;
    
    try {
      await deleteSong(songToDelete.id);
      toast({
        title: 'Song deleted',
        description: `"${songToDelete.title}" has been removed from the database.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete song',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSongToDelete(null);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedSongIds.size === 0) return;
    
    try {
      await deleteMultipleSongs(Array.from(selectedSongIds));
      setSelectedSongIds(new Set());
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  const toggleSongSelection = (songId: string, isSelected: boolean, sectionSongs: Song[]) => {
    const isShift = shiftKeyRef.current;
    const newSelection = new Set(selectedSongIds);

    if (isShift && lastSelectedId) {
      const currentIndex = sectionSongs.findIndex(s => s.id === songId);
      const lastIndex = sectionSongs.findIndex(s => s.id === lastSelectedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);

        for (let i = start; i <= end; i++) {
          if (isSelected) {
            newSelection.add(sectionSongs[i].id);
          } else {
            newSelection.delete(sectionSongs[i].id);
          }
        }
      } else {
        if (isSelected) newSelection.add(songId); else newSelection.delete(songId);
      }
    } else {
      if (isSelected) {
        newSelection.add(songId);
      } else {
        newSelection.delete(songId);
      }
    }
    
    setSelectedSongIds(newSelection);
    setLastSelectedId(songId);
  };

  const toggleSectionSelection = (sectionSongs: Song[], isSelected: boolean) => {
    const newSelection = new Set(selectedSongIds);
    sectionSongs.forEach(song => {
      if (isSelected) {
        newSelection.add(song.id);
      } else {
        newSelection.delete(song.id);
      }
    });
    setSelectedSongIds(newSelection);
  };

  const renderSongTable = (sectionSongs: Song[]) => {
    const allSelected = sectionSongs.length > 0 && sectionSongs.every(song => selectedSongIds.has(song.id));
    
    return (
    <div className="border-y sm:border border-white/5 rounded-none sm:rounded-md overflow-x-auto pb-4 scrollbar-hide -mx-4 sm:mx-0">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-white/5">
            <TableHead className="w-12 px-4 py-3 h-auto">
              <Checkbox 
                checked={allSelected} 
                onCheckedChange={(checked) => toggleSectionSelection(sectionSongs, !!checked)}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="px-4 py-3 h-auto font-semibold">Title</TableHead>
            <TableHead className="px-4 py-3 h-auto font-semibold">Artist</TableHead>
            <TableHead className="px-4 py-3 h-auto font-semibold">Genre</TableHead>
            <TableHead className="px-4 py-3 h-auto font-semibold">Date Added</TableHead>
            <TableHead className="px-4 py-3 h-auto text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectionSongs.length > 0 ? (
            sectionSongs.map((song) => (
              <TableRow
                key={song.id}
                className="border-white/5 hover:bg-muted/30 cursor-pointer"
                onClick={() => router.push(`/songs/view?id=${song.id}`)}
              >
                <TableCell 
                  className="px-4 py-4" 
                  onClickCapture={(e) => { shiftKeyRef.current = e.shiftKey; }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox 
                    checked={selectedSongIds.has(song.id)}
                    onCheckedChange={(checked) => toggleSongSelection(song.id, !!checked, sectionSongs)}
                    aria-label={`Select ${song.title}`}
                  />
                </TableCell>
                <TableCell className="px-4 py-4 font-medium">{song.title}</TableCell>
                <TableCell className="px-4 py-4 text-muted-foreground">{song.artist}</TableCell>
                <TableCell className="px-4 py-4 text-muted-foreground">
                  {Array.isArray(song.genre) ? song.genre.join(', ') : (typeof song.genre === 'string' ? song.genre : '')}
                </TableCell>
                <TableCell className="px-4 py-4 text-muted-foreground">{new Date(song.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="px-4 py-4 text-right">
                  <div
                    className="flex flex-nowrap items-center justify-end gap-1 overflow-x-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Edit"
                      onClick={() => router.push(`/songs/edit?id=${song.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Delete"
                      onClick={() => handleDelete(song)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {currentUser && currentUser.role === 'super_admin' && song.organizationId && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-400 dark:border-blue-800"
                          title="Transfer to Global (Moves the song)"
                          onClick={() => setPendingGlobalAction({ kind: 'move', song })}
                        >
                          <Globe className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 bg-green-50 hover:bg-green-100 text-green-600 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400 dark:border-green-800"
                          title="Copy to Global (Duplicates the song)"
                          onClick={() => setPendingGlobalAction({ kind: 'copy', song })}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                No songs found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <Input
            placeholder="Search songs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-sm"
          />
          <select
            value={activeOrgFilter || ''}
            onChange={(e) => setActiveOrgFilter(e.target.value || null)}
            className="h-10 text-sm rounded-md bg-background border border-input px-3 text-foreground w-full sm:w-[200px]"
          >
            <option value="">All Organizations</option>
            <option value="__global__">Global Library</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {selectedSongIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteDialogOpen(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedSongIds.size})
            </Button>
          )}
          <div className="text-sm text-muted-foreground bg-secondary/30 px-3 py-1 rounded-full border border-white/5 whitespace-nowrap">
            {filteredSections.reduce((acc, s) => acc + s.songs.length, 0)} song(s) found
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <div 
          className={`border rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
            activeOrgFilter === '__global__' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-secondary/20 border-white/5 hover:bg-secondary/30'
          }`}
          onClick={() => setActiveOrgFilter(prev => prev === '__global__' ? null : '__global__')}
        >
          <Globe className="h-5 w-5 text-blue-500 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Global</div>
            <div className="text-lg font-semibold">{groupedSongs.globalSongs.length}</div>
          </div>
        </div>
        {Object.entries(groupedSongs.orgSongs).map(([orgId, orgSongList]) => (
          <div 
            key={orgId} 
            className={`border rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
              activeOrgFilter === orgId ? 'bg-white/8 border-white/20' : 'bg-secondary/20 border-white/5 hover:bg-secondary/30'
            }`}
            onClick={() => setActiveOrgFilter(prev => prev === orgId ? null : orgId)}
          >
            <Building className="h-5 w-5 text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">{orgNameMap[orgId] || 'Unknown Org'}</div>
              <div className="text-lg font-semibold">{orgSongList.length}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Collapsible sections */}
      <div className="space-y-4">
        {filteredSections.map(section => (
          <div key={section.key}>
            <button
              onClick={() => toggleSection(section.key)}
              className="flex items-center gap-2 w-full text-left py-2 px-1 hover:bg-muted/30 rounded-md transition-colors"
            >
              {collapsedSections[section.key] 
                ? <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              }
              {section.icon === 'global' 
                ? <Globe className="h-5 w-5 text-blue-500 shrink-0" />
                : <Building className="h-5 w-5 text-purple-500 shrink-0" />
              }
              <span className="text-base font-semibold">{section.label}</span>
              <span className="text-sm text-muted-foreground ml-1">
                ({section.songs.length} {section.songs.length === 1 ? 'song' : 'songs'})
              </span>
            </button>

            {!collapsedSections[section.key] && (
              <div className="mt-2">
                {renderSongTable(section.songs)}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        icon={<Trash2 />}
        title="Delete Song"
        description={<>This will permanently delete <span className="font-bold text-white">"{songToDelete?.title}"</span>. This action cannot be undone.</>}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        icon={<Trash2 />}
        title="Delete Selected Songs"
        description={<>This will permanently delete {selectedSongIds.size} selected songs. This action cannot be undone.</>}
        confirmLabel="Delete All"
        onConfirm={confirmBulkDelete}
      />

      <ConfirmDialog
        open={!!pendingGlobalAction}
        onOpenChange={(open) => { if (!open) setPendingGlobalAction(null); }}
        destructive={false}
        icon={pendingGlobalAction?.kind === 'move' ? <Globe /> : <Copy />}
        title={pendingGlobalAction?.kind === 'move' ? 'Move to Global Library' : 'Copy to Global Library'}
        description={
          pendingGlobalAction?.kind === 'move'
            ? <>"{pendingGlobalAction?.song.title}" will be moved to the global library and will no longer belong to this organization.</>
            : <>A duplicate of "{pendingGlobalAction?.song.title}" will be created in the public library.</>
        }
        confirmLabel={pendingGlobalAction?.kind === 'move' ? 'Move' : 'Copy'}
        onConfirm={() => {
          if (!pendingGlobalAction) return;
          const { kind, song } = pendingGlobalAction;
          setPendingGlobalAction(null);
          if (kind === 'move') makeSongGlobal(song.id);
          else copySongToGlobal(song.id);
        }}
      />
    </>
  );
};

export default AdminSongList;
