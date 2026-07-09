import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SongInput } from '@/lib/types';
import { X } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  artist: z.string().min(1, { message: 'Artist is required' }),
  language: z.string().min(1, { message: 'Language is required' }),
  genre: z.string().min(1, { message: 'Genre is required' }),
  originalKey: z.string().optional(),
  lyrics: z.string().min(1, { message: 'Lyrics are required' })
    .refine((lyrics) => {
      // Check for inline chords - chords immediately followed by text without space/newline
      const inlineChordPattern = /\[[^\]]+\][^\s\n\r]/;
      return !inlineChordPattern.test(lyrics);
    }, { message: 'Inline chords are not allowed. Please place chords on separate lines above the lyrics.' }),
});

type FormValues = z.infer<typeof formSchema>;

const AdminSongForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewLanguageInput, setShowNewLanguageInput] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const { songs, addSong } = useSongs();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      artist: '',
      language: '',
      genre: '',
      originalKey: '',
      lyrics: '',
    },
  });

  // Extract languages from existing songs
  useEffect(() => {
    const standardLanguages = ['English', 'Hindi', 'Malayalam'];
    const existingLanguages = songs.map(s => s.language).filter(Boolean);
    const uniqueLanguages = Array.from(new Set([...standardLanguages, ...existingLanguages])).sort();
    setLanguages(uniqueLanguages);
  }, [songs]);

  const onSubmit = async (values: FormValues) => {
    if (!currentUser) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add a song',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const songInput: SongInput = {
        title: values.title,
        artist: values.artist,
        language: values.language,
        genre: typeof values.genre === 'string' 
          ? values.genre.split(',').map(g => g.trim()).filter(Boolean)
          : values.genre,
        lyrics: values.lyrics,
        originalKey: values.originalKey === '___auto___' ? undefined : values.originalKey,
        createdBy: currentUser.id,
      };
      
      await addSong(songInput);
      
      toast({
        title: 'Success',
        description: `${values.title} was added to the database!`,
      });
      
      // Reset form
      form.reset();
    } catch (error) {
      console.error('Failed to add song:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add song',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Song Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter song title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
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
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                    defaultValue={field.value}
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
                <FormControl>
                  <Input placeholder="Enter genres (comma separated: Rock, Pop, Folk)" {...field} />
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
                    {['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'].map(key => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
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
          name="lyrics"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lyrics with Chords</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={`Enter lyrics with chords positioned above the lyrics, like this:
              [D]               [A]
How great the chasm that lay between us
            [G]       [Bm]           [A]
How high the mountain   I could not climb`}
                  className="font-mono min-h-[300px]" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-muted-foreground mt-2">
                Chords must be on separate lines above the lyrics. Inline chords like [C]word are not allowed.
              </p>
            </FormItem>
          )}
        />
        
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Song'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default AdminSongForm;
