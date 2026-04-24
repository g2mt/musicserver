import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { type TrackData } from "src/TrackData";
import type { AudioState } from "src/AudioState";

declare global {
  interface NativeAudioBridge {
    saveTrackQueue: (serialized: string) => void;
  }
  interface Window {
    _native_audio_bridge?: NativeAudioBridge;
    _requestSaveTrackQueue?: () => void;
  }
}

export interface SerializedTrackQueue {
  index: number | null;
}

export interface TrackQueue {
  tracks: TrackData[];
  setTracks: Dispatch<SetStateAction<TrackData[]>>;
  index: number | null;
  setIndex: Dispatch<SetStateAction<number | null>>;
  add: (track: TrackData | TrackData[]) => void;
  remove: (index?: number) => void;
  next: () => void;
  prev: () => void;
  canNext: () => boolean;
  canPrev: () => boolean;
  trackNavigated: boolean;
  setTrackNavigated: Dispatch<SetStateAction<boolean>>;
  repeat: "track" | "queue" | null;
  setRepeat: Dispatch<SetStateAction<"track" | "queue" | null>>;
  loadSerializedState: (state: SerializedTrackQueue) => void;
}

export function useTrackQueue(as: AudioState): TrackQueue {
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [trackNavigated, setTrackNavigated] = useState(false);
  const [repeat, setRepeat] = useState<"track" | "queue" | null>(null);

  useEffect(() => {
    window._requestSaveTrackQueue = () => {
      console.log("_requestSaveTrackQueue called");
      window._native_audio_bridge?.saveTrackQueue(
        JSON.stringify({
          paths: tracks.map((track) => track.path),
          index,
        }),
      );
    };
    return () => {
      window._requestSaveTrackQueue = undefined;
    };
  });

  return {
    tracks,
    setTracks,
    index,
    setIndex,
    add: (track: TrackData | TrackData[]) => {
      if (Array.isArray(track)) {
        setTracks((prev) => [...prev, ...track]);
      } else {
        setTracks((prev) => [...prev, track]);
      }
    },
    remove: (toRemove?: number) => {
      if (typeof toRemove === "number") {
        setTracks((prev) => prev.filter((_, i) => i !== index));
        if (index !== null && index < toRemove) {
          setIndex((prev) => (prev ?? 1) - 1);
        } else if (index === toRemove) {
          setIndex(null);
        }
      } else {
        setTracks([]);
        setIndex(null);
      }
    },
    canPrev: () => {
      const prevIndex = (index ?? 0) - 1;
      return tracks.length > 0 && prevIndex >= 0;
    },
    prev: () => {
      const prevIndex = (index ?? 0) - 1;
      if (tracks.length > 0 && prevIndex >= 0) {
        setTrackNavigated(true);
        setIndex(prevIndex);
        as.setCurrentTrack(tracks[prevIndex]);
      }
    },
    canNext: () => {
      if (repeat === "track") return as.currentTrack !== null;
      const nextIndex = (index ?? -1) + 1;
      return (
        tracks.length > 0 && (nextIndex < tracks.length || repeat === "queue")
      );
    },
    next: () => {
      const nextIndex = (index ?? -1) + 1;
      if (repeat === "track") {
        setTrackNavigated(true);
        as.repeated.current = true;
      } else if (repeat === "queue" && nextIndex >= tracks.length) {
        setTrackNavigated(true);
        setIndex(0);
        as.setCurrentTrack(tracks[0]);
      } else if (tracks.length > 0 && nextIndex < tracks.length) {
        setTrackNavigated(true);
        setIndex(nextIndex);
        as.setCurrentTrack(tracks[nextIndex]);
      } else {
        if (index !== null) {
          setIndex(null);
        }
      }
    },
    trackNavigated,
    setTrackNavigated,
    repeat,
    setRepeat,
    loadSerializedState: (state: SerializedTrackQueue) => {
      setIndex(state.index);
    },
  };
}
