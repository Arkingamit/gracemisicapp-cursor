import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Song, SongInput, Genre } from '@/lib/types';
import { X } from 'lucide-react';
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(2, { message: 'Title must be at least 2 characters' }),
  artist: z.string().min(2, { message: 'Artist must be at least 2 characters' }),
  language: z.string().min(1, { message: 'Please select a language' }),
  genre: z.array(z.string()).min(1, { message: 'Please select at least one genre' }),
  lyrics: z.string().min(10, { message: 'Lyrics must be at least 10 characters' }),
  originalKey: z.string().optional(),
  externalUrl: z.union([z.literal(''), z.string().url('Must be a valid URL')]).optional(),
  format: z.enum(['auto', 'chordpro']).optional()
});

type FormData = z.infer<typeof formSchema>;

interface SongFormProps {
  song?: Song;
  onSuccess?: () => void;
}

const SongForm: React.FC<SongFormProps> = ({ song, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loadingGenres, setLoadingGenres] = useState(true);
  const [showNewGenreInput, setShowNewGenreInput] = useState(false);
  const [showNewLanguageInput, setShowNewLanguageInput] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [limitErrorModalOpen, setLimitErrorModalOpen] = useState(false);
  const [limitErrorMsg, setLimitErrorMsg] = useState('');
  const { toast } = useToast();
  const { songs, addSong, updateSong } = useSongs();
  const { currentUser } = useAuth();
  const { getUserOrganizations } = useOrganizations();
  const router = useRouter();
  const isEditing = !!song;
  const userOrgs = getUserOrganizations();
  const isManager = currentUser?.role === 'manager';
  // Managers only see orgs they manage
  const managedOrgs = isManager 
    ? userOrgs.filter(org => (currentUser?.id && org.managerIds.includes(currentUser.id)) || org.createdBy === currentUser?.id)
    : userOrgs;
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: song?.title || '',
      artist: song?.artist || '',
      language: song?.language || '',
      genre: song?.genre || [],
      lyrics: song?.lyrics || '',
      originalKey: song?.originalKey || '',
      externalUrl: song?.externalUrl || '',
      format: song?.format || 'auto',
    },
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    song?.organizationId || (isManager && managedOrgs.length > 0 ? managedOrgs[0].id : '')
  );

  // Extract languages from existing songs
  useEffect(() => {
    const standardLanguages = ['English', 'Hindi', 'Malayalam'];
    const existingLanguages = songs.map(s => s.language).filter(Boolean);
    const uniqueLanguages = Array.from(new Set([...standardLanguages, ...existingLanguages])).sort();
    setLanguages(uniqueLanguages);
  }, [songs]);

  // Fetch genres on component mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('/api/genres');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setGenres(data);
            return;
          }
        }
        
        // Fallback to static mock genres in case of API failure or empty response
        const standardGenres = [
          'Worship', 'Praise', 'Hymn', 'Christian Rock', 
          'Hindi Gospel', 'English Gospel', 'Modern Genres',
          'Rock', 'Pop', 'Country', 'Blues', 'Jazz', 
          'Classical', 'Folk', 'Gospel', 'R&B', 'Electronic', 
          'Alternative', 'Indie'
        ];
        const existingGenres = songs.flatMap(s => s.genre).filter(Boolean);
        const uniqueGenres = Array.from(new Set([...standardGenres, ...existingGenres])).sort();
        
        setGenres(uniqueGenres.map((name, i) => ({ 
          id: String(i), 
          name, 
          createdAt: new Date().toISOString() 
        })));
      } catch (error) {
        console.error('Failed to fetch genres:', error);
        
        // Fallback on error
        const standardGenres = [
          'Worship', 'Praise', 'Hymn', 'Christian Rock', 
          'Hindi Gospel', 'English Gospel', 'Modern Genres',
          'Rock', 'Pop', 'Country', 'Blues', 'Jazz', 
          'Classical', 'Folk', 'Gospel', 'R&B', 'Electronic', 
          'Alternative', 'Indie'
        ];
        const existingGenres = songs.flatMap(s => s.genre).filter(Boolean);
        const uniqueGenres = Array.from(new Set([...standardGenres, ...existingGenres])).sort();
        setGenres(uniqueGenres.map((name, i) => ({ 
          id: String(i), 
          name, 
          createdAt: new Date().toISOString() 
        })));
      } finally {
        setLoadingGenres(false);
      }
    };

    fetchGenres();
  }, [toast, songs]);

  const onSubmit = async (data: FormData) => {
    if (!currentUser) {
      toast({
        title: 'Not authorized',
        description: 'You must be logged in to submit a song',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isEditing && song) {
        await updateSong(song.id, {
          ...data,
          updatedAt: new Date().toISOString(),
        });
        
        toast({
          title: 'Song updated',
          description: `${data.title} has been updated successfully`,
        });
      } else {
        // Create a properly typed object for adding a song
        const songInput: SongInput = {
          title: data.title,
          artist: data.artist,
          language: data.language,
          genre: data.genre,
          lyrics: data.lyrics,
          originalKey: data.originalKey,
          externalUrl: data.externalUrl || undefined,
          format: data.format,
          createdBy: currentUser.id,
          ...(selectedOrgId && selectedOrgId !== 'global' ? { organizationId: selectedOrgId } : {}),
        };
        
        await addSong(songInput);
        
        toast({
          title: 'Song added',
          description: `${data.title} has been added successfully`,
        });
      }
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/songs');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'An unknown error occurred';
      if (msg.toLowerCase().includes('maximum limit')) {
        setLimitErrorMsg(msg);
        setLimitErrorModalOpen(true);
      } else {
        toast({
          title: isEditing ? 'Failed to update song' : 'Failed to add song',
          description: msg,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter song title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="artist"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter artist name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="originalKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Key (Optional)</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Auto-detect" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="___auto___">Auto-detect</SelectItem>
                        {/* Major keys — enharmonic pairs merged */}
                        {[
                          { value: 'C', label: 'C' },
                          { value: 'C#', label: 'C# / Db' },
                          { value: 'D', label: 'D' },
                          { value: 'D#', label: 'D# / Eb' },
                          { value: 'E', label: 'E' },
                          { value: 'F', label: 'F' },
                          { value: 'F#', label: 'F# / Gb' },
                          { value: 'G', label: 'G' },
                          { value: 'G#', label: 'G# / Ab' },
                          { value: 'A', label: 'A' },
                          { value: 'A#', label: 'A# / Bb' },
                          { value: 'B', label: 'B' },
                        ].map(k => (
                          <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                        ))}
                        {/* Minor keys — enharmonic pairs merged */}
                        {[
                          { value: 'Cm', label: 'Cm' },
                          { value: 'C#m', label: 'C#m / Dbm' },
                          { value: 'Dm', label: 'Dm' },
                          { value: 'D#m', label: 'D#m / Ebm' },
                          { value: 'Em', label: 'Em' },
                          { value: 'Fm', label: 'Fm' },
                          { value: 'F#m', label: 'F#m / Gbm' },
                          { value: 'Gm', label: 'Gm' },
                          { value: 'G#m', label: 'G#m / Abm' },
                          { value: 'Am', label: 'Am' },
                          { value: 'A#m', label: 'A#m / Bbm' },
                          { value: 'Bm', label: 'Bm' },
                        ].map(k => (
                          <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="externalUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External Link (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. YouTube or Spotify URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  {!showNewLanguageInput ? (
                    <Select 
                      onValueChange={(val) => {
                        if (val === '___new___') {
                          setShowNewLanguageInput(true);
                          setNewLanguageName('');
                        } else {
                          field.onChange(val);
                        }
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {languages.map(lang => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                        <SelectItem value="___new___" className="text-primary font-medium border-t mt-1 pt-1">
                          + Add New Language
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="Enter new language" 
                          value={newLanguageName}
                          onChange={(e) => {
                            setNewLanguageName(e.target.value);
                            field.onChange(e.target.value);
                          }}
                          autoFocus
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setShowNewLanguageInput(false);
                          if (!newLanguageName.trim()) {
                            field.onChange('');
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="genre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Genre</FormLabel>
                  {!showNewGenreInput ? (
                    <div className="space-y-2">
                      {/* Selected genres as badges */}
                      {field.value.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {field.value.map((g: string) => (
                            <span key={g} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
                              {g}
                              <button
                                type="button"
                                onClick={() => field.onChange(field.value.filter((v: string) => v !== g))}
                                className="hover:text-destructive"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <Select 
                        onValueChange={(val) => {
                          if (val === '___new___') {
                            setShowNewGenreInput(true);
                          } else if (!field.value.includes(val)) {
                            field.onChange([...field.value, val]);
                          }
                        }} 
                        value=""
                        disabled={loadingGenres}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingGenres ? "Loading genres..." : "Add a genre"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genres.map((genre) => (
                            <SelectItem key={genre.id} value={genre.name} disabled={field.value.includes(genre.name)}>
                              {field.value.includes(genre.name) ? `✓ ${genre.name}` : genre.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="___new___" className="text-purple-600 font-medium font-bold">
                            + Add New Genre
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input 
                          placeholder="Type new genre name..." 
                          autoFocus 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val && !field.value.includes(val)) {
                                field.onChange([...field.value, val]);
                              }
                              setShowNewGenreInput(false);
                            }
                          }}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        size="sm"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousElementSibling?.querySelector('input') || 
                            e.currentTarget.parentElement?.querySelector('input')) as HTMLInputElement | null;
                          const val = input?.value?.trim();
                          if (val && !field.value.includes(val)) {
                            field.onChange([...field.value, val]);
                          }
                          setShowNewGenreInput(false);
                        }}
                      >
                        Add
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowNewGenreInput(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chord Format</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-detect chords over lyrics" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect chords over lyrics</SelectItem>
                      <SelectItem value="chordpro">Bracket format [Chord]</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose <b>Auto-detect</b> to automatically convert chords placed above lyrics lines. Choose <b>Bracket format</b> if you define chords exactly within brackets `[C]` to avoid false detections.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="lyrics"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lyrics and Chords</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={`Em         C            G
Water You turned into wine
Em         C            G
Opened the eyes of the blind
                 Am
There's no one like You`}
                      className="min-h-[300px] font-mono whitespace-pre"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground mt-2">
                    Paste your song exactly as you see it! You can paste standard format with chords on the line above the lyrics, or use [ChordPro] bracket format.
                  </p>
                </FormItem>
              )}
            />

            {/* Organization Visibility Selector */}
            {!isEditing && (userOrgs.length > 0) && (
              <FormItem>
                <FormLabel>Visibility</FormLabel>
                <Select onValueChange={setSelectedOrgId} defaultValue={selectedOrgId}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Global (visible to everyone)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="global">🌐 Global (visible to everyone)</SelectItem>
                    {(isManager ? managedOrgs : userOrgs).map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        🔒 {org.name} (private)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedOrgId && selectedOrgId !== 'global'
                    ? 'Only members of this organization can see this song'
                    : 'Everyone can see this song'}
                </p>
              </FormItem>
            )}
                        
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Song' : 'Add Song'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>

    <AlertDialog open={limitErrorModalOpen} onOpenChange={setLimitErrorModalOpen}>
      <AlertDialogContent className="bg-transparent border border-white/10 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Limit Reached
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {limitErrorMsg}
            <br /><br />
            Please delete some custom songs or contact an administrator to increase your organization's limit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setLimitErrorModalOpen(false)}>
            Understood
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default SongForm;

