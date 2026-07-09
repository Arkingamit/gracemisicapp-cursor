
import SongForm from '@/components/songs/SongForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

const SongAdd = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Add New Song</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 order-2 lg:order-1">
          <SongForm />
        </div>
        
        <div className="space-y-6 order-1 lg:order-2">
          <Card className="bg-primary/5 border-primary/20 lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Lightbulb className="w-5 h-5 text-primary" />
                Step-by-Step Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">1</div>
                <div>
                  <h4 className="font-semibold text-base mb-1">Basic Info</h4>
                  <p className="text-muted-foreground leading-relaxed">Fill in the song title and artist. This makes it easy for your team to search for and identify the exact version of the song.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">2</div>
                <div>
                  <h4 className="font-semibold text-base mb-1">Key & Metadata</h4>
                  <p className="text-muted-foreground leading-relaxed">Select the original key if known, and tag the song with relevant genres (e.g., Worship, Indie) to keep your library organized.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">3</div>
                <div className="w-full">
                  <h4 className="font-semibold text-base mb-1">Paste Lyrics & Chords</h4>
                  <p className="text-muted-foreground mb-3 leading-relaxed">We support two formats. Choose the one that matches what you're pasting:</p>
                  
                  <div className="space-y-3">
                    <div className="bg-background/80 p-3 rounded-lg border border-border">
                      <strong className="text-foreground block mb-1">Format 1: Auto-detect (Chords on top)</strong>
                      <p className="text-xs text-muted-foreground mb-2">Simply paste standard lyrics with chords written on the line above.</p>
                      <pre className="text-xs text-zinc-300 font-mono bg-transparent p-2 rounded mb-2">
G      D       Em{'\n'}
This is how we paste
                      </pre>
                      <p className="text-xs text-amber-500/90 font-medium bg-amber-500/10 p-2 rounded">
                        <span className="font-bold">Tip:</span> If the system is not able to auto-detect the chords, add the chords in brackets e.g. <code className="font-mono bg-amber-500/20 px-1 rounded">[Am]</code>
                      </p>
                    </div>
                    
                    <div className="bg-background/80 p-3 rounded-lg border border-border">
                      <strong className="text-foreground block mb-1">Format 2: ChordPro (Bracketed)</strong>
                      <p className="text-xs text-muted-foreground mb-2">Write chords inside brackets exactly before the syllable.</p>
                      <pre className="text-xs text-zinc-300 font-mono bg-transparent p-2 rounded">
[G]This is [D]how we [Em]paste
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">4</div>
                <div>
                  <h4 className="font-semibold text-base mb-1">Visibility</h4>
                  <p className="text-muted-foreground leading-relaxed">If you're in an organization, you can choose to make this song private to your team or public for everyone.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SongAdd;

