
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Heart, Users, ListMusic, Building2 } from 'lucide-react';

const About = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-6 text-center">About Grace Music</h1>

      <div className="space-y-8">
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
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Favorites & Private Collections
                </h3>
                <p className="text-muted-foreground mt-1">
                  Quickly access your most-used or loved songs by marking them as favorites. Create private collections and favorite lists for easy retrieval during practice or performance.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Sets & Annotations
                </h3>
                <p className="text-muted-foreground mt-1">
                  Organize songs into groups for specific events or worship services. Managers and editors can add personal annotations and instructions directly to the set (e.g., "Verse 2: Electric Guitar Solo" or "Verse 1: Piano Only") to ensure the whole band is perfectly synced.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-primary" />
                  Collections
                </h3>
                <p className="text-muted-foreground mt-1">
                  Group related sets or songs into thematic Collections (like "Christmas", "Youth Camp", or "Sunday Services"). This helps in managing large repertoires and keeping your library meticulously organized.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Organizations
                </h3>
                <p className="text-muted-foreground mt-1">
                  Collaborate with your church or band by creating or joining Organizations. Access organization-specific song libraries and song sets, ensuring everyone is on the same page with the correct versions, keys, and arrangements.
                </p>
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
                  <a href="https://github.com/Arkingamit" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
                    GitHub Profile
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default About;
