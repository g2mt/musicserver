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
import { Settings } from "./settings";

export const AppStateSchema = z.object({
  volume: z.number().default(1),
  muted: z.boolean().default(false),
  enqueuedTracks: z.array(TrackDataSchema).default([]),
  searchQuery: z.string().default(""),
  darkMode: z.boolean().default(false),
  showBlurredCover: z.boolean().default(true),
  showOnlyQueueAfterEnqueue: z.boolean().default(false),
});

export type AppStateData = z.infer<typeof AppStateSchema>;

export interface AppState extends AppStateData {
  currentTrack: TrackData | null;
  setCurrentTrack: Dispatch<SetStateAction<TrackData | null>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
  duration: number;
  setDuration: Dispatch<SetStateAction<number>>;
  setVolume: Dispatch<SetStateAction<number>>;
  setMuted: Dispatch<SetStateAction<boolean>>;
  enqueuedTrackIndex: number | null;
  setEnqueuedTracks: Dispatch<SetStateAction<TrackData[]>>;
  enqueueTrack: (_: TrackData | TrackData[]) => void;
  unqueueTrack: (index?: number) => void;
  addConfirmBox: (confirmBox: React.ReactNode) => void;
  setEnqueuedTrackIndex: Dispatch<SetStateAction<number | null>>;
  setSearchQuery: (_: string) => void;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  setShowBlurredCover: Dispatch<SetStateAction<boolean>>;
  props: { version: string; config: any } | null;
  setProps: Dispatch<SetStateAction<{ version: string; config: any } | null>>;
  oldSearchQuery: RefObject<string | null>;
  onRescanned: () => void;
  refreshSearch: () => void;
  leftTab: "tracks" | "settings" | "files";
  setLeftTab: Dispatch<SetStateAction<"tracks" | "settings" | "files">>;
  tracksListCollapsed: boolean;
  setTracksListCollapsed: Dispatch<SetStateAction<boolean>>;
  queueCollapsed: boolean;
  setQueueCollapsed: Dispatch<SetStateAction<boolean>>;
  trackQueueScroll: (index: number) => void;
  showOnlyQueueAfterEnqueue: boolean;
  setShowOnlyQueueAfterEnqueue: Dispatch<SetStateAction<boolean>>;
  fbPath: string[];
  setFbPath: Dispatch<SetStateAction<string[]>>;
}

export const AppContext = createContext<AppState | null>(null);

const CONFIG_KEY = "_config";

export function mergeConfig(dest: AppState) {
  const saved = Settings.getItem(CONFIG_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const config = AppStateSchema.parse(parsed);
      if (config.volume !== undefined) dest.setVolume(config.volume);
      if (config.muted !== undefined) dest.setMuted(config.muted);
      if (config.enqueuedTracks.length > 0)
        dest.setEnqueuedTracks(config.enqueuedTracks);
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
    volume: state.volume,
    muted: state.muted,
    enqueuedTracks: state.enqueuedTracks,
    searchQuery: state.searchQuery,
    darkMode: state.darkMode,
    showBlurredCover: state.showBlurredCover,
  };
  Settings.setItem(CONFIG_KEY, JSON.stringify(config));
}
