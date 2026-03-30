import {
  createContext,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import * as z from "zod";
import type React from "react";
import { toast } from "react-toastify";
import { TrackDataSchema, type TrackData } from "./TrackData";

declare global {
  interface NativeSettings {
    getItem(key: string): string;
    setItem(key: string, value: string): void;
  }
  interface Window {
    _native_settings?: NativeSettings;
  }
}

export const AppStateSchema = z.object({
  currentTrack: TrackDataSchema.nullable().default(null),
  isPlaying: z.boolean().default(false),
  progress: z.number().default(0),
  duration: z.number().default(0),
  volume: z.number().default(1),
  muted: z.boolean().default(false),
  enqueuedTracks: z.array(TrackDataSchema).default([]),
  enqueuedTrackIndex: z.number().nullable().default(null),
  searchQuery: z.string().default(""),
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
  enqueueTrack: (_: TrackData | TrackData[]) => void;
  unqueueTrack: (index?: number) => void;
  addConfirmBox: (confirmBox: React.ReactNode) => void;
  setEnqueuedTrackIndex: Dispatch<SetStateAction<number | null>>;
  setSearchQuery: (_: string) => void;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  setShowBlurredCover: Dispatch<SetStateAction<boolean>>;
  showAllTracks: () => void;
  oldSearchQuery: RefObject<string | null>;
  onRescanned: () => void;
  refreshSearch: () => void;
}

export const AppContext = createContext<AppState | null>(null);

const CONFIG_KEY = "_config";

export function mergeConfig(dest: AppState) {
  const saved = (window._native_settings ?? localStorage).getItem(CONFIG_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const config = AppStateSchema.parse(parsed);
      if (config.currentTrack !== null)
        dest.setCurrentTrack(config.currentTrack);
      if (config.isPlaying !== undefined) dest.setIsPlaying(config.isPlaying);
      if (config.progress !== undefined) dest.setProgress(config.progress);
      if (config.duration !== undefined) dest.setDuration(config.duration);
      if (config.volume !== undefined) dest.setVolume(config.volume);
      if (config.muted !== undefined) dest.setMuted(config.muted);
      if (config.enqueuedTracks.length > 0)
        dest.setEnqueuedTracks(config.enqueuedTracks);
      if (config.enqueuedTrackIndex !== null)
        dest.setEnqueuedTrackIndex(config.enqueuedTrackIndex);
      if (config.searchQuery !== "") dest.setSearchQuery(config.searchQuery);
      if (config.darkMode !== undefined) dest.setDarkMode(config.darkMode);
      if (config.showBlurredCover !== undefined)
        dest.setShowBlurredCover(config.showBlurredCover);
    } catch (e: any) {
      toast.error(
        <p>
          Failed to parse config from localStorage: <b>{e.toString()}</b>
        </p>,
      );
    }
  }
}

export function saveConfig(state: AppState) {
  const config: AppStateData = {
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    progress: state.progress,
    duration: state.duration,
    volume: state.volume,
    muted: state.muted,
    enqueuedTracks: state.enqueuedTracks,
    enqueuedTrackIndex: state.enqueuedTrackIndex,
    searchQuery: state.searchQuery,
    darkMode: state.darkMode,
    showBlurredCover: state.showBlurredCover,
  };
  (window._native_settings ?? localStorage).setItem(
    CONFIG_KEY,
    JSON.stringify(config),
  );
}
