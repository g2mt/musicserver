import { useState, type Dispatch, type SetStateAction } from "react";
import { type TrackData } from "./TrackData";
import type { AudioState } from "./AudioState";

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
  const [index, setIndex] = useState<number | null>(
    null,
  );

  const add = (track: TrackData | TrackData[]) => {
    if (Array.isArray(track)) {
      setTracks((prev) => [...prev, ...track]);
    } else {
      setTracks((prev) => [...prev, track]);
    }
  };

  const remove = (index?: number) => {
    if (typeof index === "number") {
      setTracks((prev) => prev.filter((_, i) => i !== index));
      if (index !== null && index < index) {
        setIndex((prev) => (prev ?? 1) - 1);
      } else if (index === index) {
        setIndex(null);
      }
    } else {
      setTracks([]);
      setIndex(null);
    }
  };

  const next = () => {
    const nextIndex = (index ?? -1) + 1;
    if (tracks.length > 0 && nextIndex < tracks.length) {
      setIndex(nextIndex);
      as.setCurrentTrack(tracks[nextIndex]);
    } else {
      if (index !== null) {
        setIndex(null);
      }
    }
  };

  return {
    tracks,
    setTracks,
    index,
    setIndex,
    add,
    remove,
    next,
  };
}
