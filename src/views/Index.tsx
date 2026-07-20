
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSongs } from '@/contexts/SongContext';
import { useAuth } from '@/contexts/AuthContext';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton grid matching the genre/language card layout (2 cols mobile, 3-4 cols desktop) */
const GenreGridSkeleton = ({ count }: { count: number }) => (
  <div className="home-genre-grid">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="relative overflow-hidden aspect-[4/3] rounded-xl">
        <Skeleton className="absolute inset-0 rounded-xl" />
        <div className="absolute bottom-4 left-4 space-y-2">
          <Skeleton className="h-4 w-24 bg-white/10" />
          <Skeleton className="h-3 w-16 bg-white/10" />
        </div>
      </div>
    ))}
  </div>
);

/* ──────────────────────────────────────────────
   Known genre → visual mapping.
   Any genre in the DB that matches one of these
   keys gets that gradient + image.
   ────────────────────────────────────────────── */
const GENRE_VISUALS: Record<string, { gradient: string; image: string }> = {
  worship: {
    gradient: 'linear-gradient(135deg, rgba(88,28,135,0.85), rgba(49,46,129,0.6))',
    image: '/genre-images/worship.png',
  },
  praise: {
    gradient: 'linear-gradient(135deg, rgba(109,40,217,0.8), rgba(67,56,202,0.55))',
    image: '/genre-images/praise.png',
  },
  'modern genres': {
    gradient: 'linear-gradient(135deg, rgba(219,39,119,0.85), rgba(168,85,247,0.6))',
    image: '/genre-images/modern.png',
  },
  'christian rock': {
    gradient: 'linear-gradient(135deg, rgba(79,70,229,0.8), rgba(109,40,217,0.55))',
    image: '/genre-images/rock.png',
  },
  'hindi gospel': {
    gradient: 'linear-gradient(135deg, rgba(161,98,7,0.85), rgba(120,53,15,0.6))',
    image: '/genre-images/hindi_gospel.png',
  },
  'english gospel': {
    gradient: 'linear-gradient(135deg, rgba(30,58,138,0.85), rgba(55,48,163,0.6))',
    image: '/genre-images/english_gospel.png',
  },
};

/* Deterministic hue from string so unknown genres get a stable colour */
function hashHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/* Fallback gradient palette for genres without a predefined visual */
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, rgba(190,24,93,0.85), rgba(157,23,77,0.6))',
  'linear-gradient(135deg, rgba(13,148,136,0.85), rgba(15,118,110,0.6))',
  'linear-gradient(135deg, rgba(217,119,6,0.85), rgba(180,83,9,0.6))',
  'linear-gradient(135deg, rgba(37,99,235,0.85), rgba(29,78,216,0.6))',
  'linear-gradient(135deg, rgba(139,92,246,0.85), rgba(124,58,237,0.6))',
  'linear-gradient(135deg, rgba(220,38,38,0.85), rgba(185,28,28,0.6))',
  'linear-gradient(135deg, rgba(22,163,74,0.85), rgba(21,128,61,0.6))',
];

interface GenreCard {
  name: string;
  gradient: string;
  image: string;
  songCount: number;
}

const Index = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { songs, loading } = useSongs();
  const { currentUser } = useAuth();
  const router = useRouter();

  /* Build genre cards purely from actual songs */
  const genreCards = useMemo(() => {
    const genreMap = new Map<string, number>();

    songs.forEach((song) => {
      const genres = song.genre || [];
      genres.forEach((g) => {
        const genre = typeof g === 'string' ? g.trim() : '';
        if (!genre) return;
        genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
      });
    });

    let fallbackIdx = 0;
    const cards: GenreCard[] = [];

    genreMap.forEach((count, genre) => {
      const key = genre.toLowerCase();
      const visual = GENRE_VISUALS[key];

      cards.push({
        name: genre,
        songCount: count,
        gradient: visual?.gradient ||
          FALLBACK_GRADIENTS[fallbackIdx % FALLBACK_GRADIENTS.length] ||
          `linear-gradient(135deg, hsl(${hashHue(genre)}, 70%, 35%, 0.85), hsl(${hashHue(genre) + 40}, 60%, 25%, 0.6))`,
        image: visual?.image || '/genre-images/worship.png',
      });

      if (!visual) fallbackIdx++;
    });

    // Sort alphabetically
    cards.sort((a, b) => a.name.localeCompare(b.name));
    return cards;
  }, [songs]);

  const languageCards = useMemo(() => {
    const langMap = new Map<string, number>();

    songs.forEach((song) => {
      const lang = song.language?.trim();
      if (!lang) return;
      langMap.set(lang, (langMap.get(lang) || 0) + 1);
    });

    const cards: GenreCard[] = [];
    langMap.forEach((count, lang) => {
      cards.push({
        name: lang,
        songCount: count,
        gradient: `linear-gradient(135deg, hsl(${hashHue(lang)}, 70%, 35%, 0.85), hsl(${hashHue(lang) + 40}, 60%, 25%, 0.6))`,
        image: '/genre-images/worship.png',
      });
    });

    cards.sort((a, b) => a.name.localeCompare(b.name));
    return cards;
  }, [songs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/songs?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleGenreClick = (genreName: string) => {
    router.push(`/songs?genre=${encodeURIComponent(genreName)}`);
  };

  const handleLanguageClick = (langName: string) => {
    router.push(`/songs?language=${encodeURIComponent(langName)}`);
  };

  return (
    <div className="home-page">
      {/* ─── Search Bar ─── */}
      <form onSubmit={handleSearch} className="home-search-wrapper" data-tour="search-bar">
        <div className="home-search-bar">
          <Search className="home-search-icon" size={18} />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="home-search-input"
          />
        </div>
      </form>

      {/* ─── Languages ─── */}
      <section className="home-browse-section" data-tour="language-section">
        <h2 className="home-browse-title">Languages</h2>

        {loading ? (
          <GenreGridSkeleton count={3} />
        ) : languageCards.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            No languages found.
          </div>
        ) : (
          <div className="home-genre-grid">
            {languageCards.map((card) => (
              <button
                key={card.name}
                className="home-genre-card"
                onClick={() => handleLanguageClick(card.name)}
                style={
                  {
                    '--card-gradient': card.gradient,
                    '--card-image': `url(${card.image})`,
                  } as React.CSSProperties
                }
              >
                <span className="home-genre-label">{card.name}</span>
                <span className="home-genre-count">{card.songCount} {card.songCount === 1 ? 'song' : 'songs'}</span>
                <div className="home-genre-img-wrapper">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="home-genre-img"
                    loading="lazy"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── Browse All ─── */}
      <section className="home-browse-section mt-8" data-tour="genre-section">
        <h2 className="home-browse-title">Browse All</h2>

        {loading ? (
          <GenreGridSkeleton count={8} />
        ) : genreCards.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            No songs yet. Add some songs to see genres here!
          </div>
        ) : (
          <div className="home-genre-grid">
            {genreCards.map((card) => (
              <button
                key={card.name}
                className="home-genre-card"
                onClick={() => handleGenreClick(card.name)}
                style={
                  {
                    '--card-gradient': card.gradient,
                    '--card-image': `url(${card.image})`,
                  } as React.CSSProperties
                }
              >
                <span className="home-genre-label">{card.name}</span>
                <span className="home-genre-count">{card.songCount} {card.songCount === 1 ? 'song' : 'songs'}</span>
                <div className="home-genre-img-wrapper">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="home-genre-img"
                    loading="lazy"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};

export default Index;
