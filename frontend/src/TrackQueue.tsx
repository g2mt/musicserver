import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { type TrackData } from "./TrackData";
import type { AudioState } from "./AudioState";

declare global {
  interface NativeAudioBridge {
    saveTrackQueue: (serialized: string) => void;
  }
  interface Window {
    _native_audio_bridge?: NativeAudioBridge;
    _requestSaveTrackQueue?: () => void;
    _setTrackQueueIndex?: (index: number) => void;
  }
}

export interface TrackQueue {
  tracks: TrackData[];
  setTracks: Dispatch<SetStateAction<TrackData[]>>;
  index: number | null;
  setIndex: Dispatch<SetStateAction<number | null>>;
  add: (track: TrackData | TrackData[]) => void;
  remove: (index?: number) => void;
  next: () => void;
}

export function useTrackQueue(as: AudioState): TrackQueue {
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    window._requestSaveTrackQueue = () => {
      window._native_audio_bridge?.saveTrackQueue(
        JSON.stringify({
          paths: tracks.map((track) => track.path),
          index,
        }),
      );
    };
    window._setTrackQueueIndex = (index: number) => {
      setIndex(index);
    };
    return () => {
      window._requestSaveTrackQueue = undefined;
      window._setTrackQueueIndex = undefined;
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
    next: () => {
      const nextIndex = (index ?? -1) + 1;
      if (tracks.length > 0 && nextIndex < tracks.length) {
        setIndex(nextIndex);
        as.setCurrentTrack(tracks[nextIndex]);
      } else {
        if (index !== null) {
          setIndex(null);
        }
      }
    },
  };
}
