export interface TourStep {
  /** CSS selector to highlight the target element */
  selector: string;
  /** Step heading */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Preferred tooltip placement relative to the target */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** The page path this step belongs to (use '*' for global/any page) */
  page: string;
}

export const TOUR_STEPS: TourStep[] = [
  // ─── Home Page ───
  {
    selector: '[data-tour="search-bar"]',
    title: '🔍 Search Songs',
    description: 'Quickly find any song by title, artist, or keyword. Type and hit enter to search across your entire library.',
    placement: 'bottom',
    page: '/',
  },
  {
    selector: '[data-tour="language-section"]',
    title: '🌐 Browse by Language',
    description: 'Songs are organized by language. Tap a card to see all songs in that language — perfect for multilingual worship services.',
    placement: 'bottom',
    page: '/',
  },
  {
    selector: '[data-tour="genre-section"]',
    title: '🎵 Browse by Genre',
    description: 'Explore songs by genre like Worship, Praise, Rock, or Gospel. Each card shows you how many songs are available.',
    placement: 'top',
    page: '/',
  },

  // ─── Bottom Navigation (Mobile) ───
  {
    selector: '[data-tour="nav-songs"]',
    title: '🎶 Songs Tab',
    description: 'Your complete song library with all lyrics and chords. Search, filter, transpose keys, and export PDFs from here.',
    placement: 'top',
    page: '*',
  },
  {
    selector: '[data-tour="nav-favorites"]',
    title: '❤️ Favorites Tab',
    description: 'Songs you\'ve hearted will appear here for quick access during worship practice or live services.',
    placement: 'top',
    page: '*',
  },
  {
    selector: '[data-tour="nav-library"]',
    title: '📚 Collections Tab',
    description: 'Create themed collections like "Christmas Songs", "Youth Camp", or "Sunday Morning" to keep your library organized.',
    placement: 'top',
    page: '*',
  },
  {
    selector: '[data-tour="nav-sets"]',
    title: '📋 Song Sets Tab',
    description: 'Song Sets are live setlists for a specific service or event. Arrange songs in order, add notes, and share with your band.',
    placement: 'top',
    page: '*',
  },
  {
    selector: '[data-tour="nav-orgs"]',
    title: '🏛️ Organizations Tab',
    description: 'Organizations represent your church or band. Join one to access its private song library, sets, and collaborate with your team.',
    placement: 'top',
    page: '*',
  },

  // ─── Sets Page ───
  {
    selector: '[data-tour="create-set"]',
    title: '📝 Create a Set',
    description: 'When planning a service, create a Song Set. You can add songs in a specific order and share the setlist with your band members.',
    placement: 'bottom',
    page: '/groups',
  },

  // ─── Organizations Page ───
  {
    selector: '[data-tour="org-actions"]',
    title: '🏢 Create or Join an Org',
    description: 'Organizations let you collaborate with your church team. You can create your own organization, or join an existing one using an invite code.',
    placement: 'bottom',
    page: '/organizations',
  },

  // ─── Global Elements ───
  {
    selector: '[data-tour="notification-bell"]',
    title: '🔔 Notifications',
    description: 'Stay updated! You\'ll get notified when new sets are created, someone joins your organization, or when there are updates.',
    placement: 'bottom',
    page: '*',
  },
  {
    selector: '[data-tour="profile-menu"]',
    title: '👤 Your Profile',
    description: 'Access your profile, give feedback, view the About page, and log out from this menu. Admins can also access the dashboard here.',
    placement: 'bottom',
    page: '*',
  },
  {
    selector: '[data-tour="add-song"]',
    title: '➕ Add Songs',
    description: 'Click here to add a new song to your library! If you are part of an organization, you can choose to save the song directly to your organization\'s catalog.',
    placement: 'bottom',
    page: '*',
  },
  {
    selector: '[data-tour="ai-chatbot"]',
    title: '✨ Grace Copilot (AI Assistant)',
    description: 'Your personal worship AI! Ask it to build setlists, suggest songs by mood or key, or help plan your next service. Try: "Suggest 5 worship songs in the key of G"',
    placement: 'top',
    page: '*',
  },
];

export const GROUP_TOUR_STEPS: TourStep[] = [
  // ─── Set Details Page (starts only after the set has ≥1 song) ───
  {
    selector: '[data-tour="set-share-link"]',
    title: '🔗 Share Set Link',
    description: 'Quickly copy the link to this set to share it with anyone.',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-share-whatsapp"]',
    title: '💬 Share to WhatsApp',
    description: 'Share this set directly to your band\'s WhatsApp group.',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-export-pdf"]',
    title: '📄 Export PDF',
    description: 'Export all songs in this set into a single, beautifully formatted PDF document. You can adjust font sizes and choose to include or hide chords before exporting.',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-musicians"]',
    title: '🎸 Assign Musicians',
    description: 'Assign band members to specific roles for this set. They will be notified automatically.',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-transpose"]',
    title: '🎼 Transpose Key',
    description: 'Need to sing it higher or lower? Change the key instantly or switch to the Number System (Nashville Numbers).',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-use-flats"]',
    title: '♭ Use Flats',
    description: 'Toggle this to display chords with flats (e.g., Bb) instead of sharps (e.g., A#).',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-edit-layout"]',
    title: '🎨 Edit Layout & Colors',
    description: 'Click Edit Layout to customize this song! You can add personal comments, insert musical annotations, and change the colors of the chords and lyrics.',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-settings"]',
    title: '⚙️ Display Settings',
    description: 'Personalize your view! Toggle between light/dark theme, turn on chord highlighting, or completely hide all chords to just see the lyrics.',
    placement: 'bottom',
    page: '/groups/view',
  },
  {
    selector: '[data-tour="set-add-songs"]',
    title: '➕ Add More Songs',
    description: 'Keep building your setlist anytime — add more songs from your library as your service grows.',
    placement: 'bottom',
    page: '/groups/view',
  },
];

export const ADD_SONG_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="song-format-select"]',
    title: '📝 Choose Format',
    description: 'You can either let us auto-detect chords over lyrics, or use [Bracket] format for precise placement.',
    placement: 'bottom',
    page: '/songs/new',
  },
  {
    selector: '[data-tour="song-lyrics-input"]',
    title: '✂️ Paste Your Song',
    description: 'Just paste your lyrics and chords here exactly as you have them.',
    placement: 'right',
    page: '/songs/new',
  },
  {
    selector: '[data-tour="song-live-preview"]',
    title: '👀 Live Preview',
    description: 'Watch your song come to life! We will automatically highlight detected chords here in real-time so you can verify them before submitting.',
    placement: 'left',
    page: '/songs/new',
  },
  {
    selector: '[data-tour="song-next-btn"]',
    title: '➡️ Next Step',
    description: 'Once it looks good, click Next to add the title, artist, and other details.',
    placement: 'top',
    page: '/songs/new',
  }
];

/** Key used in localStorage to track tour completion */
export const TOUR_STORAGE_KEY = 'grace-onboarding-tour-completed';

/** Key used in localStorage to signal tour should start */
export const TOUR_START_KEY = 'grace-onboarding-tour-start';

/** Optional: start the global tour at the step matching this selector */
export const TOUR_START_FROM_SELECTOR_KEY = 'grace-onboarding-tour-from-selector';

/** Key used in localStorage to track group tour completion */
export const GROUP_TOUR_STORAGE_KEY = 'grace-group-tour-completed';

/** Key used in localStorage to signal group tour should start (after set has songs) */
export const GROUP_TOUR_START_KEY = 'grace-group-tour-start';

/** Custom event: set view is ready for group tour (has ≥1 song) */
export const GROUP_TOUR_READY_EVENT = 'grace-group-tour-ready';

/** Custom event: expand first song so transpose/layout tour targets are visible */
export const GROUP_TOUR_EXPAND_EVENT = 'grace-group-tour-expand';

/** Custom event: expand musicians panel for the assign-musicians tour step */
export const GROUP_TOUR_EXPAND_MUSICIANS_EVENT = 'grace-group-tour-expand-musicians';

/** Key used in localStorage to track add song tour completion */
export const ADD_SONG_TOUR_STORAGE_KEY = 'grace-add-song-tour-completed';

/** Key used in localStorage to signal add song tour should start */
export const ADD_SONG_TOUR_START_KEY = 'grace-add-song-tour-start';
