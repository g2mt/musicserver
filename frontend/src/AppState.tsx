import { createContext, type Dispatch, type SetStateAction } from 'react';
import type React from 'react';
import type { TrackData } from './Track';
import './MusicPlayer.css';


export interface AppState {
  currentTrack: TrackData | null;
  setCurrentTrack: Dispatch<SetStateAction<TrackData | null>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
  duration: number;
  setDuration: Dispatch<SetStateAction<number>>;
  volume: number;
  setVolume: Dispatch<SetStateAction<number>>;
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>>;
  enqueuedTracks: TrackData[];
  setEnqueuedTracks: Dispatch<SetStateAction<TrackData[]>>;
  enqueueTrack: (_: TrackData) => void;
  unqueueTrack: (index: number) => void;
  confirmBoxes: React.ReactNode[];
  setConfirmBoxes: Dispatch<SetStateAction<React.ReactNode[]>>;
  addConfirmBox: (confirmBox: React.ReactNode) => void;
  enqueuedTrackIndex: number|null;
  setEnqueuedTrackIndex: Dispatch<SetStateAction<number|null>>;
  searchQuery: string;
  setSearchQuery: (_: string) => void;
}

export const AppContext = createContext<AppState|null>(null);
