import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  createContext,
} from "react";
import type React from "react";
import { toast } from "react-toastify";
import * as z from "zod";

import type { AudioState } from "src/AudioState";
import { type TrackQueue } from "src/TrackQueue";
import { Settings } from "src/settings";

export const SearchQuerySchema = z.object({
  q: z.string().default(""),
  limit: z.number().int().default(0),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export interface ServerConfig {
  version: string;
  config: {
    http_bind: string;
    unix_bind_enabled: boolean;
    unix_bind: string;
    data_path: string;
    db_dir: string;
    cache_db_enabled: boolean;
    cover_cache_max_bytes: number;
    media_downloader: string;
  };
}

// Contains serializable options for saving
export const AppStateSchema = z.object({
  volume: z.number().default(1),
  muted: z.boolean().default(false),
  searchQuery: SearchQuerySchema.default({ q: "", limit: 0 }),
  darkMode: z.boolean().default(false),
  showBlurredCover: z.boolean().default(true),
  showOnlyQueueAfterEnqueue: z.boolean().default(false),
  shuffleBeforePlayingAll: z.boolean().default(true),
  searchHistoryLimit: z.number().min(0).max(9999).default(10),
  showTracksListOnTabChange: z.boolean().default(false),
});

export type AppStateData = z.infer<typeof AppStateSchema>;

// Full state of the App
export interface AppState extends AppStateData {
  // audio
  as: AudioState;
  setVolume: Dispatch<SetStateAction<number>>;
  setMuted: Dispatch<SetStateAction<boolean>>;

  // track queue
  queue: TrackQueue;

  // search
  setSearchQuery: Dispatch<SetStateAction<SearchQuery>>;
  oldSearchQuery: RefObject<SearchQuery | null>;
  refreshSearch: () => () => void;

  // filter/sorting
  resultSort: string;
  setResultSort: Dispatch<SetStateAction<string>>;
  resultDesc: boolean;
  setResultDesc: Dispatch<SetStateAction<boolean>>;
  resultLimit: number;
  setResultLimit: Dispatch<SetStateAction<number>>;

  // search history
  setSearchHistoryLimit: Dispatch<SetStateAction<number>>;

  // config setters
  setShuffleBeforePlayingAll: Dispatch<SetStateAction<boolean>>;
  setShowTracksListOnTabChange: Dispatch<SetStateAction<boolean>>;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  setShowBlurredCover: Dispatch<SetStateAction<boolean>>;

  // server props
  props: ServerConfig | null;
  setProps: Dispatch<SetStateAction<ServerConfig | null>>;

  // misc event handlers
  onRescanned: () => void;

  // ### UI

  // left tab
  leftTab: "tracks" | "settings" | "files";
  setLeftTab: Dispatch<SetStateAction<"tracks" | "settings" | "files">>;

  // track list
  tracksListCollapsed: boolean;
  setTracksListCollapsed: Dispatch<SetStateAction<boolean>>;

  // queue ui
  queueCollapsed: boolean;
  setQueueCollapsed: Dispatch<SetStateAction<boolean>>;
  setShowOnlyQueueAfterEnqueue: Dispatch<SetStateAction<boolean>>;

  // file browser path
  fbPath: string[];
  setFbPath: Dispatch<SetStateAction<string[]>>;

  // misc ui functions
  scrollToTop: () => void;
  addConfirmBox: (confirmBox: React.ReactNode) => void;
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
      if (config.searchQuery !== undefined)
        dest.setSearchQuery(config.searchQuery);
      if (config.darkMode !== undefined) dest.setDarkMode(config.darkMode);
      if (config.showBlurredCover !== undefined)
        dest.setShowBlurredCover(config.showBlurredCover);
      if (config.showOnlyQueueAfterEnqueue !== undefined)
        dest.setShowOnlyQueueAfterEnqueue(config.showOnlyQueueAfterEnqueue);
      if (config.shuffleBeforePlayingAll !== undefined)
        dest.setShuffleBeforePlayingAll(config.shuffleBeforePlayingAll);
      if (config.searchHistoryLimit !== undefined)
        dest.setSearchHistoryLimit(config.searchHistoryLimit);
      if (config.showTracksListOnTabChange !== undefined)
        dest.setShowTracksListOnTabChange(config.showTracksListOnTabChange);
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
    searchQuery: state.searchQuery,
    darkMode: state.darkMode,
    showBlurredCover: state.showBlurredCover,
    showOnlyQueueAfterEnqueue: state.showOnlyQueueAfterEnqueue,
    shuffleBeforePlayingAll: state.shuffleBeforePlayingAll,
    searchHistoryLimit: state.searchHistoryLimit,
    showTracksListOnTabChange: state.showTracksListOnTabChange,
  };
  Settings.setItem(CONFIG_KEY, JSON.stringify(config));
}
