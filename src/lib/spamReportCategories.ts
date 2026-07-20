export type SongReportCategory =
  | 'misplaced_chords'
  | 'incomplete_song'
  | 'wrong_metadata'
  | 'other';

export const SONG_REPORT_CATEGORIES: {
  key: SongReportCategory;
  label: string;
  description: string;
}[] = [
  {
    key: 'misplaced_chords',
    label: 'Misplaced chords & text',
    description: 'Chords are out of place or text is poorly formatted',
  },
  {
    key: 'incomplete_song',
    label: 'Incomplete song',
    description: 'Missing verses, chorus, or unfinished content',
  },
  {
    key: 'wrong_metadata',
    label: 'Wrong title, genre, or language',
    description: 'Title, genre, or language does not match the song',
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Something else is wrong with this contribution',
  },
];

export function getReportCategoryLabel(category: SongReportCategory): string {
  return SONG_REPORT_CATEGORIES.find((c) => c.key === category)?.label || category;
}

export type ModerationStatus = 'ok' | 'flagged' | 'restricted';

export type SpamFlagSource =
  | 'verifier_report'
  | 'rejection_threshold'
  | 'song_report_threshold'
  | 'admin';
