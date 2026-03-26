import { createContext, type Dispatch, type SetStateAction } from 'react';
import * as z from "zod";
import type React from 'react';
import type { TrackData } from './Track';
import './MusicPlayer.css';

export const AppStateSchema = z.object({
  currentTrack: TrackData.nullable(),
  isPlaying: z.boolean(),
  progress: z.number(),
  duration: z.number(),
  volume: z.number(),
  muted: z.boolean(),
  enqueuedTracks: z.array(TrackData),
  enqueuedTrackIndex: z.number().nullable(),
  searchQuery: z.string(),
  darkMode: z.boolean(),
  showBlurredCover: z.boolean(),
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
