import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { User } from 'lucide-react';
import { Song } from '@/lib/types';
import { getTransposedKeyName, getKeyDisplayName } from '@/lib/chordUtils';
import { detectKey } from '@/lib/keyDetection';
import { useAuth } from '@/contexts/AuthContext';
import { useSongs } from '@/contexts/SongContext';
import { useRouter } from 'next/navigation';
import LyricsDisplay from './LyricsDisplay';
import TransposeControls from './TransposeControls';
import { PlayCircle, Youtube, ListMusic, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SongDisplayProps {
  song: Song;
  showActions?: boolean;
  fontSize?: number;
  transposition?: number;
  useFlats?: boolean;
  onTransposeUp?: () => void;
  onTransposeDown?: () => void;
  onResetTransposition?: () => void;
  onFontSizeChange?: (delta: number) => void;
  onUseFlatsChange?: (checked: boolean) => void;
  useNumberSystem?: boolean;
  onUseNumberSystemChange?: (checked: boolean) => void;
}

const SongDisplay: React.FC<SongDisplayProps> = ({
  song,
  showActions = true,
  fontSize = 16,
  transposition = 0,
  useFlats = false,
  onTransposeUp,
  onTransposeDown,
  onResetTransposition,
  onFontSizeChange,
  onUseFlatsChange,
  useNumberSystem = false,
  onUseNumberSystemChange
}) => {
  const [internalTransposition, setInternalTransposition] = useState(0);
  const [internalNumberSystem, setInternalNumberSystem] = useState(false);
  const [lightTheme, setLightTheme] = useState(false);
  const [chordHighlight, setChordHighlight] = useState(false);
  const [hideAllChords, setHideAllChords] = useState(false);
  const { currentUser } = useAuth();
  const { deleteSong } = useSongs();
  const router = useRouter();

  // Use external transposition if provided, otherwise use internal state
  const currentTransposition = transposition !== undefined ? transposition : internalTransposition;
  const currentNumberSystem = onUseNumberSystemChange ? useNumberSystem : internalNumberSystem;

  // Reset transposition when song changes using key from parent is preferred, 
  // but for local UI fixes, we use a single stable effect or derived logic.
  // The lint error triggers if setInternalTransposition is called synchronously.
  useEffect(() => {
    if (transposition === undefined) {
      setTimeout(() => setInternalTransposition(0), 0);
    }
  }, [song.id, transposition]);

  const originalKey = song.originalKey || detectKey(song.lyrics);
  const currentKey = getTransposedKeyName(originalKey, currentTransposition);

  const handleTransposeUp = () => {
    if (onTransposeUp) {
      onTransposeUp();
    } else if (internalTransposition < 11) {
      setInternalTransposition(internalTransposition + 1);
    }
  };

  const handleTransposeDown = () => {
    if (onTransposeDown) {
      onTransposeDown();
    } else if (internalTransposition > -11) {
      setInternalTransposition(internalTransposition - 1);
    }
  };

  const handleReset = () => {
    if (onResetTransposition) {
      onResetTransposition();
    } else {
      setInternalTransposition(0);
    }
  };

  return (
    <Card className={`rounded-lg sm:rounded-xl border-x sm:border-x transition-all duration-150 w-full ${lightTheme ? 'bg-white text-zinc-900 border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/50'}`}>
      <CardHeader className="p-3 sm:px-4 sm:py-3 select-none">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ListMusic className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-semibold mr-2">{song.title}</span>
            {song.externalUrl && (() => {
              const isYoutube = song.externalUrl.toLowerCase().includes('youtube.com') || song.externalUrl.toLowerCase().includes('youtu.be');
              const Icon = isYoutube ? Youtube : PlayCircle;
              return (
                <a
                  href={song.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md"
                  title={isYoutube ? "Watch on YouTube" : "Listen to song"}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{isYoutube ? "Listen" : "Listen"}</span>
                </a>
              );
            })()}
          </CardTitle>
          <div className="text-sm font-medium text-muted-foreground">
            Key: {getKeyDisplayName(currentKey)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        <div className="mb-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border-b border-white/5 pb-4 mt-2">
            <div className="flex flex-wrap items-center gap-4">
              <TransposeControls
                transposition={currentTransposition}
                currentKey={currentKey}
                onTransposeUp={handleTransposeUp}
                onTransposeDown={handleTransposeDown}
                onReset={handleReset}
                useNumberSystem={currentNumberSystem}
                onNumberSystemChange={onUseNumberSystemChange || setInternalNumberSystem}
                lightTheme={lightTheme}
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className={lightTheme ? "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100" : ""} onClick={() => onFontSizeChange && onFontSizeChange(2)}>A+</Button>
                <Button variant="outline" size="sm" className={lightTheme ? "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100" : ""} onClick={() => onFontSizeChange && onFontSizeChange(-2)}>A-</Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id={`flat-toggle`}
                  checked={useFlats}
                  onCheckedChange={(checked) => onUseFlatsChange && onUseFlatsChange(checked)}
                  className={lightTheme ? "data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-zinc-900 [&>span]:bg-white" : ""}
                />
                <Label htmlFor={`flat-toggle`}>Use flats</Label>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-2 ${lightTheme ? "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100" : ""}`}>
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" align="end">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none mb-3 text-sm">Display Settings</h4>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="theme-toggle" className="cursor-pointer">Light Theme</Label>
                      <Switch id="theme-toggle" checked={lightTheme} onCheckedChange={setLightTheme} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="highlight-toggle" className="cursor-pointer">Highlight Chords</Label>
                      <Switch id="highlight-toggle" checked={chordHighlight} onCheckedChange={setChordHighlight} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hide-chords-toggle" className="cursor-pointer">Hide All Chords</Label>
                      <Switch id="hide-chords-toggle" checked={hideAllChords} onCheckedChange={setHideAllChords} />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="p-0 sm:p-2 rounded-md">
            <LyricsDisplay
              lyrics={song.lyrics}
              transposition={currentTransposition}
              useFlats={useFlats}
              fontSize={fontSize}
              format={song.format}
              useNumberSystem={currentNumberSystem}
              currentKey={currentKey}
              chordHighlight={chordHighlight}
              hideAllChords={hideAllChords}
              onHideAllChordsChange={setHideAllChords}
            />
          </div>
      </CardContent>
    </Card>
  );
};

export default SongDisplay;
