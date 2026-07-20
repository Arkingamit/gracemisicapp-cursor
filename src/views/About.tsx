"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Heart, Users, ListMusic, Building2, Sparkles, PlayCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  TOUR_START_KEY,
  TOUR_STORAGE_KEY,
  TOUR_START_FROM_SELECTOR_KEY,
  ADD_SONG_TOUR_START_KEY,
  ADD_SONG_TOUR_STORAGE_KEY,
} from '@/lib/tourSteps';
import { useState } from 'react';
import { FeedbackModal } from '@/components/common/FeedbackModal';

type FeatureTour = {
  path: string;
  /** Global tour step selector, or use addSongTour for song creation */
  selector?: string;
  addSongTour?: boolean;
};

const FEATURE_TOURS: Record<string, FeatureTour> = {
  songs: { path: '/songs/new', addSongTour: true },
  favorites: { path: '/favorites', selector: '[data-tour="nav-favorites"]' },
  sets: { path: '/groups', selector: '[data-tour="create-set"]' },
  collections: { path: '/playlists', selector: '[data-tour="nav-library"]' },
  organizations: { path: '/organizations', selector: '[data-tour="org-actions"]' },
};

const About = () => {
  const router = useRouter();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const handleStartTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.removeItem(TOUR_START_FROM_SELECTOR_KEY);
    localStorage.setItem(TOUR_START_KEY, 'true');
    router.push('/');
  };

  const handleFeatureTour = (key: keyof typeof FEATURE_TOURS) => {
    const tour = FEATURE_TOURS[key];
    if (tour.addSongTour) {
      localStorage.removeItem(ADD_SONG_TOUR_STORAGE_KEY);
      localStorage.setItem(ADD_SONG_TOUR_START_KEY, 'true');
      router.push(tour.path);
      return;
    }
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.setItem(TOUR_START_KEY, 'true');
    if (tour.selector) {
      localStorage.setItem(TOUR_START_FROM_SELECTOR_KEY, tour.selector);
    } else {
      localStorage.removeItem(TOUR_START_FROM_SELECTOR_KEY);
    }
    router.push(tour.path);
  };

  const TourLink = ({ feature }: { feature: keyof typeof FEATURE_TOURS }) => (
    <button
      type="button"
      onClick={() => handleFeatureTour(feature)}
      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
    >
      <PlayCircle className="w-4 h-4" />
      Take a tour
    </button>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-6 text-center">About Grace Music</h1>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-primary" />
              Interactive Onboarding Tour
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <p className="text-muted-foreground leading-relaxed">
              New here? Or just want a refresher on how to use Grace Music? 
              Take our interactive guided tour to explore all the features.
            </p>
            <Button 
              onClick={handleStartTour}
              className="w-full sm:w-auto whitespace-nowrap"
            >
              Start Tour
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What is Grace Music?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">
              Grace Music is a platform designed for musicians and songwriters to store, display, and manage song lyrics with embedded chords. Our system can automatically detect chords and lyrics—so you can simply copy and paste standard text, and the system will handle the rest!
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Core Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Music className="w-5 h-5 text-primary" />
                  Songs & Customization
                </h3>
                <p className="text-muted-foreground mt-1">
                  The heart of Grace Music. Easily import songs, change the colors of your chords and lyrics to fit your preference, and export beautifully formatted PDFs. You can even hide chords for specific sections or for the entire song when you just need the lyrics!
                </p>
                <TourLink feature="songs" />
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Favorites & Private Collections
                </h3>
                <p className="text-muted-foreground mt-1">
                  Quickly access your most-used or loved songs by marking them as favorites. Create private collections and favorite lists for easy retrieval during practice or performance.
                </p>
                <TourLink feature="favorites" />
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Sets & Annotations
                </h3>
                <p className="text-muted-foreground mt-1">
                  Organize songs into groups for specific events or worship services. Managers and editors can add personal annotations and instructions directly to the set (e.g., &quot;Verse 2: Electric Guitar Solo&quot; or &quot;Verse 1: Piano Only&quot;) to ensure the whole band is perfectly synced.
                </p>
                <TourLink feature="sets" />
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-primary" />
                  Collections
                </h3>
                <p className="text-muted-foreground mt-1">
                  Group related sets or songs into thematic Collections (like &quot;Christmas&quot;, &quot;Youth Camp&quot;, or &quot;Sunday Services&quot;). This helps in managing large repertoires and keeping your library meticulously organized.
                </p>
                <TourLink feature="collections" />
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Organizations
                </h3>
                <p className="text-muted-foreground mt-1">
                  Collaborate with your church or band by creating or joining Organizations. Access organization-specific song libraries and song sets, ensuring everyone is on the same page with the correct versions, keys, and arrangements.
                </p>
                <TourLink feature="organizations" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transposition</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">
              The transposition feature allows you to change the key of a song without rewriting all the chords. Select a number of half-steps (semitones) to shift by, and all chords will be automatically adjusted. You can also switch between sharp (#) and flat (b) notation.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Grace Copilot (AI Assistant)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                Grace Copilot is your personal worship ministry AI assistant, designed to help you plan services and find songs quickly.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-foreground">Building Setlists:</strong> Ask Grace to &quot;build a 4-song worship setlist about surrender&quot; or &quot;suggest fast praise songs in the key of G&quot;.</li>
                <li><strong className="text-foreground">Song Recommendations:</strong> Grace searches your catalog (both global and your organization&apos;s songs) to provide relevant suggestions with clickable links.</li>
                <li><strong className="text-foreground">Key Compatibility:</strong> Ask for advice on transitioning between songs or checking if two songs flow well together.</li>
                <li><strong className="text-foreground">Music Focus:</strong> Grace is strictly trained for music and worship ministry assistance, ensuring it stays on-topic and helpful for your team.</li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(TOUR_STORAGE_KEY);
                  localStorage.setItem(TOUR_START_KEY, 'true');
                  localStorage.setItem(TOUR_START_FROM_SELECTOR_KEY, '[data-tour="ai-chatbot"]');
                  router.push('/');
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <PlayCircle className="w-4 h-4" />
                Take a tour
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-primary">Global Roles</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Admin:</strong> Can add, edit, and delete any song or organization in the system.</li>
                  <li><strong className="text-foreground">Editor:</strong> Can add new songs and edit/delete any song in the global library.</li>
                  <li><strong className="text-foreground">Viewer:</strong> Can view public songs but not edit or add content.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-primary">Organization Roles</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Manager:</strong> Has full control over the organization. Can manage members, roles, and all organization content (sets, collections, songs).</li>
                  <li><strong className="text-foreground">Editor:</strong> Can add, edit, and organize songs, sets, and collections within the organization.</li>
                  <li><strong className="text-foreground">Member:</strong> Can view and use all organization content but cannot make changes.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="leading-relaxed">
                For questions, support, or feedback, please reach out to the developer:
              </p>
              <div className="bg-accent/50 p-4 rounded-lg border border-border">
                <h3 className="font-semibold text-lg mb-1">Arkin Gamit</h3>
                <p className="text-muted-foreground text-sm mb-3">Lead Developer</p>
                <div className="flex flex-col space-y-2">
                  <a href="mailto:gamitarkin2@gmail.com" className="inline-flex items-center text-primary hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                    Contact via Email
                  </a>
                  <Button
                    variant="outline" 
                    className="w-full sm:w-auto mt-2 flex items-center gap-2"
                    onClick={() => setIsFeedbackOpen(true)}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Submit App Feedback
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
      
      <FeedbackModal 
        isOpen={isFeedbackOpen} 
        onClose={() => setIsFeedbackOpen(false)} 
      />
    </div>
  );
};

export default About;
