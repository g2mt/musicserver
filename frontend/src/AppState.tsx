import {
  createContext,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import * as z from "zod";
import type React from "react";
import { toast } from "react-toastify";
import { type TrackQueue } from "./TrackQueue";
import { Settings } from "./settings";
import type { AudioState } from "./AudioState";

export const AppStateSchema = z.object({
  volume: z.number().default(1),
  muted: z.boolean().default(false),
  searchQuery: z.string().default(""),
  darkMode: z.boolean().default(false),
  showBlurredCover: z.boolean().default(true),
  showOnlyQueueAfterEnqueue: z.boolean().default(false),
  searchHistoryLimit: z.number().min(0).max(9999).default(10),
});

export type AppStateData = z.infer<typeof AppStateSchema>;

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

  // search history
  setSearchHistoryLimit: Dispatch<SetStateAction<number>>;

  // config setters
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  setShowBlurredCover: Dispatch<SetStateAction<boolean>>;

  // server props
  props: { version: string; config: any } | null;
  setProps: Dispatch<SetStateAction<{ version: string; config: any } | null>>;

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
      if (config.searchQuery !== "") dest.setSearchQuery(config.searchQuery);
      if (config.darkMode !== undefined) dest.setDarkMode(config.darkMode);
      if (config.showBlurredCover !== undefined)
        dest.setShowBlurredCover(config.showBlurredCover);
      if (config.showOnlyQueueAfterEnqueue !== undefined)
        dest.setShowOnlyQueueAfterEnqueue(config.showOnlyQueueAfterEnqueue);
      if (config.searchHistoryLimit !== undefined)
        dest.setSearchHistoryLimit(config.searchHistoryLimit);
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
    searchHistoryLimit: state.searchHistoryLimit,
  };
  Settings.setItem(CONFIG_KEY, JSON.stringify(config));
}
