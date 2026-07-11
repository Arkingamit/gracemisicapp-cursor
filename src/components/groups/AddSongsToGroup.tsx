import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSongs } from '@/contexts/SongContext';
import { detectKey } from '@/lib/keyDetection';
import { useGroups } from '@/contexts/groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MUSICAL_KEYS = [
  // Major keys
  'C', 'C# / Db', 'D', 'D# / Eb', 'E', 'F', 'F# / Gb', 'G', 'G# / Ab', 'A', 'A# / Bb', 'B',
  // Minor keys
  'Cm', 'C#m / Dbm', 'Dm', 'D#m / Ebm', 'Em', 'Fm', 'F#m / Gbm', 'Gm', 'G#m / Abm', 'Am', 'A#m / Bbm', 'Bm'
];

interface AddSongsToGroupProps {
  groupId: string;
  existingSongIds: string[];
  onCancel: () => void;
}

const AddSongsToGroup = ({ groupId, existingSongIds, onCancel }: AddSongsToGroupProps) => {
  const { songs } = useSongs();
  const { addSongToGroup } = useGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  
  // Filter out songs that are already in the group
  const availableSongs = songs.filter(song => !existingSongIds.includes(song.id));
  
  // Pre-calculate keys
  const songKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    availableSongs.forEach(song => {
      keys[song.id] = song.originalKey || detectKey(song.lyrics);
    });
    return keys;
  }, [availableSongs]);

  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    availableSongs.forEach(song => {
      if (song.language) langs.add(song.language);
    });
    return Array.from(langs).sort();
  }, [availableSongs]);

  // Apply search and dropdown filters
  const filteredSongs = availableSongs.filter(song => {
    // 1. Language filter
    if (languageFilter !== 'all' && song.language?.toLowerCase() !== languageFilter.toLowerCase()) {
      return false;
    }

    const songKey = songKeys[song.id] || '';
    
    // 2. Key filter
    if (keyFilter !== 'all') {
      const allowedKeys = keyFilter.split(/ \/ /);
      if (!allowedKeys.includes(songKey)) {
        return false;
      }
    }

    // 3. Text search
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    
    if (q.startsWith('key:')) {
      return songKey.toLowerCase() === q.substring(4).trim();
    }
    
    const searchTokens = q.split(/\s+/).filter(Boolean);
    return searchTokens.every(token => 
      songKey.toLowerCase() === token || // exact key match
      song.title.toLowerCase().includes(token) ||
      song.artist.toLowerCase().includes(token) ||
      song.genre.some(g => g.toLowerCase().includes(token))
    );
  });
  
  const handleToggleSelection = (songId: string) => {
    const newSelection = new Set(selectedSongs);
    if (newSelection.has(songId)) {
      newSelection.delete(songId);
    } else {
      newSelection.add(songId);
    }
    setSelectedSongs(newSelection);
  };
  
  const handleAddSongs = async () => {
    if (selectedSongs.size === 0) return;
    
    setIsSubmitting(true);
    
    try {
      // Add each selected song to the group
      for (const songId of selectedSongs) {
        await addSongToGroup(groupId, songId);
      }
      
      // Navigate back to group page
      router.push(`/groups/view?id=${groupId}`);
    } catch (error) {
      console.error('Failed to add songs to group:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Add Songs to Song Set</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            size="sm"
            disabled={selectedSongs.size === 0 || isSubmitting} 
            onClick={handleAddSongs}
            className="bg-zinc-700 hover:bg-zinc-600 text-white"
          >
            {isSubmitting 
              ? 'Adding...' 
              : `Add ${selectedSongs.size} ${selectedSongs.size === 1 ? 'Song' : 'Songs'}`}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Langs</SelectItem>
              {availableLanguages.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={keyFilter} onValueChange={setKeyFilter}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Key" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Keys</SelectItem>
              {MUSICAL_KEYS.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {filteredSongs.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            {availableSongs.length === 0 
              ? 'No songs available to add to this song set' 
              : 'No songs match your search criteria'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-800/60 rounded-xl bg-zinc-950/30 mt-4">
            <Table className="table-fixed w-full border-collapse">
              <TableHeader>
                <TableRow className="bg-zinc-800 hover:bg-zinc-800 data-[state=selected]:bg-zinc-800 border-b border-zinc-800/80">
                  <TableHead className="w-[50px] px-2 sm:px-4 text-center">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead className="w-[42%] px-2 sm:px-4 text-base">Title</TableHead>
                  <TableHead className="w-[28%] px-2 sm:px-4 text-base">Artist</TableHead>
                  <TableHead className="w-[15%] px-2 sm:px-4 text-base">Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSongs.map((song) => (
                  <TableRow 
                    key={song.id}
                    className="cursor-pointer select-none transition-colors"
                    onClick={() => handleToggleSelection(song.id)}
                  >
                    <TableCell className="px-2 sm:px-4">
                      <div className="flex justify-center items-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedSongs.has(song.id)}
                          onCheckedChange={() => handleToggleSelection(song.id)}
                          className="h-5 w-5"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium px-2 sm:px-4 text-base">
                      <div className="line-clamp-2" title={song.title}>
                        {song.title}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 text-base">
                      <div className="line-clamp-2" title={song.artist}>
                        {song.artist}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap px-2 sm:px-4 text-base">
                      {songKeys[song.id] || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

    </Card>
  );
};

export default AddSongsToGroup;
