import { useState, useEffect, useRef } from 'react';
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
import { ADD_SONG_TOUR_START_KEY, ADD_SONG_TOUR_STORAGE_KEY } from '@/lib/tourSteps';
import { X, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import LyricsDisplay from './LyricsDisplay';
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { hasAnyRole } from '@/lib/roles';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

const TITLE_MAX = 50;
const ARTIST_MAX = 30;
const GENRE_MAX = 20;
const LANGUAGE_MAX = 20;

const formSchema = z.object({
  title: z
    .string()
    .min(2, { message: 'Title must be at least 2 characters' })
    .max(TITLE_MAX, { message: `Title must be at most ${TITLE_MAX} characters` }),
  artist: z
    .string()
    .min(2, { message: 'Artist must be at least 2 characters' })
    .max(ARTIST_MAX, { message: `Artist must be at most ${ARTIST_MAX} characters` }),
  language: z
    .string()
    .min(1, { message: 'Please select a language' })
    .max(LANGUAGE_MAX, { message: `Language must be at most ${LANGUAGE_MAX} characters` }),
  genre: z
    .array(
      z.string().max(GENRE_MAX, { message: `Genre must be at most ${GENRE_MAX} characters` })
    )
    .min(1, { message: 'Please select at least one genre' }),
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
  const [step, setStep] = useState<1 | 2>(1);
  const { toast } = useToast();
  const { songs, addSong, updateSong } = useSongs();
  const { currentUser } = useAuth();
  const { getUserOrganizations } = useOrganizations();
  const router = useRouter();
  const isEditing = !!song;
  const userOrgs = getUserOrganizations();
  
  const canAddGlobal = hasAnyRole(currentUser, 'editor');
  
  // Only org managers or super_admins can add to an org's private library
  const managedOrgs = userOrgs.filter(org => 
    hasAnyRole(currentUser, 'super_admin') || 
    (currentUser?.id && org.managerIds?.includes(currentUser.id)) || 
    org.createdBy === currentUser?.id
  );
  
  const defaultOrgId = song?.organizationId || 
    (canAddGlobal ? 'global' : (managedOrgs.length > 0 ? managedOrgs[0].id : ''));
  
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

  const [selectedOrgId, setSelectedOrgId] = useState<string>(defaultOrgId);

  useEffect(() => {
    // Only trigger tour on 'new song' mode, not when editing
    if (!isEditing) {
      const hasSeenTour = localStorage.getItem(ADD_SONG_TOUR_STORAGE_KEY);
      if (!hasSeenTour) {
        localStorage.setItem(ADD_SONG_TOUR_START_KEY, 'true');
      }
    }
  }, [isEditing]);

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

    // Removed restriction on global library to allow pending submissions

    if (selectedOrgId && selectedOrgId !== 'global' && !managedOrgs.find(o => o.id === selectedOrgId)) {
      toast({
        title: 'Not authorized',
        description: 'You must be a manager of the selected organization to add a song to it.',
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
        
        const isPending = (!selectedOrgId || selectedOrgId === 'global') && !canAddGlobal;
        
        toast({
          title: isPending ? 'Song submitted for verification' : 'Song added',
          description: isPending 
            ? `${data.title} is now pending verification by an administrator.`
            : `${data.title} has been added successfully`,
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

  // Desktop (web view) uses resizable side-by-side panes; mobile stays stacked
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const lyricsEditorPane = (
    <div className="flex h-full flex-1 flex-col space-y-4">
      <FormField
        control={form.control}
        name="format"
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-tour="song-format-select">
              <FormLabel className="text-lg">Paste Lyrics & Chords</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className="w-[240px] bg-zinc-900/50">
                    <SelectValue placeholder="Auto-detect chords" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect chords over lyrics</SelectItem>
                  <SelectItem value="chordpro">Bracket format [Chord]</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-zinc-400">
              Paste your song exactly as you see it! We'll instantly highlight detected chords in the preview panel.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="lyrics"
        render={({ field }) => (
          <FormItem className="flex-1 flex flex-col" data-tour="song-lyrics-input">
            <FormControl>
              <Textarea 
                placeholder={form.watch('format') === 'chordpro' 
                  ? `[Em]Water You [C]turned into [G]wine\n[Em]Opened the [C]eyes of the [G]blind\nThere's no one [Am]like You`
                  : `Em         C            G\nWater You turned into wine\nEm         C            G\nOpened the eyes of the blind\n                 Am\nThere's no one like You`}
                className="flex-1 min-h-[400px] xl:min-h-[600px] font-mono whitespace-pre text-base bg-zinc-950/50 border-zinc-800 focus-visible:ring-primary/30"
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const livePreviewPane = (
    <div className="flex h-full flex-1 flex-col border border-zinc-800/60 rounded-xl bg-zinc-900/30 overflow-hidden min-h-[400px] xl:min-h-[600px]" data-tour="song-live-preview">
      <div className="bg-zinc-800/40 px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="font-semibold text-zinc-300">Live Preview</span>
        <span className="text-xs text-primary/80 bg-primary/10 px-2 py-1 rounded-full font-medium">Chords Highlighted</span>
      </div>
      <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
        {form.watch('lyrics').trim().length > 0 ? (
          <LyricsDisplay 
            lyrics={form.watch('lyrics')}
            format={form.watch('format')}
            chordHighlight={true}
            fontSize={15}
            columns={1}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/30 flex items-center justify-center">
              <span className="text-3xl opacity-50">🎵</span>
            </div>
            <p>Your preview will appear here</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className="max-w-5xl mx-auto">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className={`flex items-center ${step >= 1 ? 'text-primary' : 'text-zinc-500'}`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold ${step >= 1 ? 'border-primary bg-primary/10' : 'border-zinc-500'}`}>
            1
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Lyrics & Chords</span>
        </div>
        <div className={`w-12 sm:w-24 h-1 mx-4 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-zinc-800'}`} />
        <div className={`flex items-center ${step >= 2 ? 'text-primary' : 'text-zinc-500'}`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold ${step >= 2 ? 'border-primary bg-primary/10' : 'border-zinc-500'}`}>
            2
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Song Details</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* STEP 1: Lyrics & Chords Canvas */}
          <div className={step === 1 ? 'block' : 'hidden'}>
            <Card className="border-primary/20 shadow-lg shadow-primary/5">
              <CardContent className="pt-6">
                {isDesktop ? (
                  <ResizablePanelGroup direction="horizontal" className="min-h-[600px]">
                    <ResizablePanel defaultSize={50} minSize={30} className="pr-4">
                      {lyricsEditorPane}
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-zinc-800" />
                    <ResizablePanel defaultSize={50} minSize={30} className="pl-4">
                      {livePreviewPane}
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : (
                  <div className="flex flex-col gap-6">
                    {lyricsEditorPane}
                    {livePreviewPane}
                  </div>
                )}

                <div className="flex justify-between items-center mt-8 pt-6 border-t border-zinc-800/60">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.back()}
                    className="text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    size="lg"
                    className="gap-2 px-8"
                    data-tour="song-next-btn"
                    onClick={async () => {
                      // Trigger validation only for the lyrics and format fields before moving to step 2
                      const isValid = await form.trigger(['lyrics', 'format']);
                      if (isValid) {
                        setStep(2);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    Next: Song Details <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* STEP 2: Song Details */}
          <div className={step === 2 ? 'block' : 'hidden'}>
            <Card className="max-w-2xl mx-auto border-primary/20 shadow-lg shadow-primary/5">
              <CardContent className="pt-8 space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter song title"
                      maxLength={TITLE_MAX}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground text-right">
                    {field.value?.length || 0}/{TITLE_MAX}
                  </p>
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
                      <Input
                        placeholder="Enter artist name"
                        maxLength={ARTIST_MAX}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground text-right">
                      {field.value?.length || 0}/{ARTIST_MAX}
                    </p>
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
                          maxLength={LANGUAGE_MAX}
                          value={newLanguageName}
                          onChange={(e) => {
                            const val = e.target.value.slice(0, LANGUAGE_MAX);
                            setNewLanguageName(val);
                            field.onChange(val);
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
                          <SelectItem value="___new___" className="text-white font-medium font-bold">
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
                          maxLength={GENRE_MAX}
                          autoFocus 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim().slice(0, GENRE_MAX);
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
                          const val = input?.value?.trim().slice(0, GENRE_MAX);
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
            
            {/* Visibility Selector */}
            {!isEditing && (
              <FormItem>
                <FormLabel>Visibility</FormLabel>
                <Select onValueChange={setSelectedOrgId} defaultValue={selectedOrgId}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Global (visible to everyone)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="global">
                      🌐 Global (visible to everyone) {!canAddGlobal && '(Requires Verification)'}
                    </SelectItem>
                    {managedOrgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        🔒 {org.name} (private)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedOrgId && selectedOrgId !== 'global'
                    ? 'Only members of this organization can see this song'
                    : 'Everyone can see this song once verified'}
                </p>
              </FormItem>
            )}
                        
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-zinc-800/60">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={isSubmitting}
              >
                <ChevronLeft className="w-4 h-4" /> Back to Lyrics
              </Button>
              <Button type="submit" size="lg" className="px-8" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Song' : 'Submit Song'}
              </Button>
            </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>

    <AlertDialog open={limitErrorModalOpen} onOpenChange={setLimitErrorModalOpen}>
      <AlertDialogContent size="sm" className="bg-zinc-950 border border-white/10 text-white">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-red-950/60 text-red-400">
            <AlertCircle />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-destructive">
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

