import { createContext, type Dispatch, type SetStateAction } from 'react';
import * as z from "zod";
import type React from 'react';
import { TrackDataSchema, type TrackData } from './Track';
import './MusicPlayer.css';

export const AppStateSchema = z.object({
  currentTrack: TrackDataSchema.nullable().default(null),
  isPlaying: z.boolean().default(false),
  progress: z.number().default(0),
  duration: z.number().default(0),
  volume: z.number().default(1),
  muted: z.boolean().default(false),
  enqueuedTracks: z.array(TrackDataSchema).default([]),
  enqueuedTrackIndex: z.number().nullable().default(null),
  searchQuery: z.string().default(''),
  darkMode: z.boolean().default(false),
  showBlurredCover: z.boolean().default(true),
});

export type AppStateData = z.infer<typeof AppStateSchema>;

export interface AppState extends AppStateData {
  setCurrentTrack: Dispatch<SetStateAction<TrackData | null>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setProgress: Dispatch<SetStateAction<number>>;
  setDuration: Dispatch<SetStateAction<number>>;
  setVolume: Dispatch<SetStateAction<number>>;
  setMuted: Dispatch<SetStateAction<boolean>>;
  setEnqueuedTracks: Dispatch<SetStateAction<TrackData[]>>;
  enqueueTrack: (_: TrackData) => void;
  unqueueTrack: (index: number) => void;
  addConfirmBox: (confirmBox: React.ReactNode) => void;
  setEnqueuedTrackIndex: Dispatch<SetStateAction<number|null>>;
  setSearchQuery: (_: string) => void;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  setShowBlurredCover: Dispatch<SetStateAction<boolean>>;
}

export const AppContext = createContext<AppState|null>(null);
