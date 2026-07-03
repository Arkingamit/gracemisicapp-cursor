// Type alias to avoid importing mongodb on the client side
type ObjectId = string;
import type { SongEditState } from './songEditTypes';

// User roles
export type UserRole = 'super_admin' | 'editor' | 'manager' | 'user';

// Organization-level roles (separate from global UserRole)
export type OrgRole = 'manager' | 'editor' | 'user';

export interface User {
  id: string;
  email: string;
  username: string; // Required in the interface
  name: string;
  role: UserRole;
  createdAt: string;
  displayName: string; // Required in the interface
  photoURL: string; // Required in the interface
  aiChatLimitMB?: number;
}

export interface MongoUser {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  username?: string; // Making this optional for backward compatibility
  displayName?: string; // Making this optional for backward compatibility
  photoURL?: string; // Making this optional for backward compatibility
  aiChatLimitMB?: number;
}

// Add Genre interface
export interface Genre {
  id: string;
  name: string;
  createdAt: string;
}

export interface MongoGenre {
  _id: ObjectId;
  name: string;
  createdAt: Date;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string[];
  language: string;
  lyrics: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  originalKey?: string;
  organizationId?: string; // null/undefined = global, string = org-private
  externalUrl?: string;
  keywords?: string[];
  format?: 'auto' | 'chordpro';
  structure?: {
    lines: Array<{
      type: 'chord' | 'lyric' | 'both';
      content: string;
      chords?: Array<{
        chord: string;
        position: number;
      }>;
    }>;
  };
}

export interface SongInput {
  title: string;
  artist: string;
  genre: string[];
  language: string;
  lyrics: string;
  createdBy: string;
  originalKey?: string;
  organizationId?: string;
  externalUrl?: string;
  keywords?: string[];
  format?: 'auto' | 'chordpro';
}

export interface SongUpdateInput {
  title?: string;
  artist?: string;
  genre?: string[];
  language?: string;
  lyrics?: string;
  updatedAt?: string; // Making this optional for backward compatibility
  originalKey?: string; // Add original key field
  externalUrl?: string;
  keywords?: string[];
  format?: 'auto' | 'chordpro';
}

export interface MongoSong {
  _id: ObjectId;
  title: string;
  artist: string;
  genre: string | string[]; // DB may have old string or new string[]
  language: string;
  lyrics: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  originalKey?: string;
  organizationId?: string;
  externalUrl?: string;
  keywords?: string[];
  format?: 'auto' | 'chordpro';
  structure?: {
    lines: Array<{
      type: 'chord' | 'lyric' | 'both';
      content: string;
      chords?: Array<{
        chord: string;
        position: number;
      }>;
    }>;
  };
}

// Add a new interface for song transpositions
export interface SongTransposition {
  songId: string;
  transposition: number;
  useFlats?: boolean;
}

// Musician instrument assignment per song set
export interface MusicianAssignment {
  userId: string;
  instrument: string;
}

// Rename Group to SongSet in display names, but keep Group internally for now
export interface Group {
  id: string;
  name: string;
  organizationId: string;
  members: string[];
  songs: string[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  // Add the songTranspositions array to store per-song transpositions for this group
  songTranspositions?: SongTransposition[];
  songEditStates?: Record<string, SongEditState>;
  musicianAssignments?: MusicianAssignment[];
}

export interface GroupInput {
  name: string;
  organizationId: string;
  members?: string[];
}

export interface GroupUpdateInput {
  name?: string;
  members?: string[];
  organizationId?: string; // Adding this to fix type errors
  songTranspositions?: SongTransposition[];
  songs?: string[]; // For reordering songs within the group
  songEditStates?: Record<string, SongEditState>;
  musicianAssignments?: MusicianAssignment[];
}

export interface MongoGroup {
  _id: ObjectId;
  name: string;
  organizationId: string;
  members: string[];
  songs: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  songTranspositions?: SongTransposition[];
  songEditStates?: Record<string, any>; // stored as plain JSON in MongoDB
  musicianAssignments?: MusicianAssignment[];
}

export interface Organization {
  id: string;
  name: string;
  members: string[];
  groups: string[];
  createdBy: string;
  managerIds: string[];
  editorIds: string[];
  createdAt: string;
  maxMembersLimit?: number | null;
  maxSongsPerGroupLimit?: number | null;
  maxCustomSongsLimit?: number | null;
  customInstruments?: string[];
  musicianStatsVisibility?: 'all' | 'editors' | 'managers';
  statsDataRetentionMonths?: number | null;
  joinCode?: string;
}

export interface OrganizationInput {
  name: string;
  members: string[];
  managerIds?: string[];
  editorIds?: string[];
  joinCode?: string;
}

export interface OrganizationUpdateInput {
  name?: string;
  members?: string[];
  maxMembersLimit?: number | null;
  maxSongsPerGroupLimit?: number | null;
  maxCustomSongsLimit?: number | null;
  customInstruments?: string[];
  musicianStatsVisibility?: 'all' | 'editors' | 'managers';
  statsDataRetentionMonths?: number | null;
}

export interface MongoOrganization {
  _id: ObjectId;
  name: string;
  members: string[];
  groups: string[];
  createdBy: string;
  managerIds: string[];
  editorIds: string[];
  managerId?: string; // Legacy support
  createdAt: Date;
  updatedAt: Date;
  maxMembersLimit?: number | null;
  maxSongsPerGroupLimit?: number | null;
  maxCustomSongsLimit?: number | null;
  customInstruments?: string[];
  musicianStatsVisibility?: 'all' | 'editors' | 'managers';
  statsDataRetentionMonths?: number | null;
  joinCode?: string;
}

export interface JoinRequest {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  groupId: string;
  createdBy: string;
  createdAt: string;
}

export interface MessageInput {
  content: string;
  groupId: string;
}

export interface MongoMessage {
  _id: ObjectId;
  content: string;
  groupId: string;
  createdBy: string;
  createdAt: Date;
}

export interface AdminStats {
  totalSongs: number;
  totalUsers: number;
  usersCount?: number;
  songsCount?: number;
  groupsCount?: number;
  organizationsCount?: number;
  songsPerGenre: Record<string, number>;
  recentlyAddedSongs?: Song[];
  usersByRole?: Record<string, number>;
}

export interface Playlist {
  id: string;
  name: string;
  userId: string;
  songs: string[]; // Array of song IDs
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistInput {
  name: string;
  userId: string;
  songs?: string[];
}

export interface MongoPlaylist {
  _id: ObjectId;
  name: string;
  userId: string;
  songs: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Favorite {
  userId: string;
  songId: string;
  createdAt: string;
}

export interface MongoFavorite {
  _id: ObjectId;
  userId: string;
  songId: string;
  createdAt: Date;
}
