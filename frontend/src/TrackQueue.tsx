import { useState, type Dispatch, type SetStateAction } from "react";
import * as z from "zod";
import { TrackDataSchema, type TrackData } from "./TrackData";
import type { AudioState } from "./AudioState";

export interface TrackQueue {
  enqueuedTracks: TrackData[];
  enqueuedTrackIndex: number | null;
  setEnqueuedTracks: Dispatch<SetStateAction<TrackData[]>>;
  enqueueTrack: (track: TrackData | TrackData[]) => void;
  unqueueTrack: (index?: number) => void;
  setEnqueuedTrackIndex: Dispatch<SetStateAction<number | null>>;
  goNextQueue: () => void;
}

export function useTrackQueue(as: AudioState): TrackQueue {
  const [enqueuedTracks, setEnqueuedTracks] = useState<TrackData[]>([]);
  const [enqueuedTrackIndex, setEnqueuedTrackIndex] = useState<number | null>(
    null,
  );

  const enqueueTrack = (track: TrackData | TrackData[]) => {
    if (Array.isArray(track)) {
      setEnqueuedTracks((prev) => [...prev, ...track]);
    } else {
      setEnqueuedTracks((prev) => [...prev, track]);
    }
  };

  const unqueueTrack = (index?: number) => {
    if (typeof index === "number") {
      setEnqueuedTracks((prev) => prev.filter((_, i) => i !== index));
      if (enqueuedTrackIndex !== null && index < enqueuedTrackIndex) {
        setEnqueuedTrackIndex((prev) => (prev ?? 1) - 1);
      } else if (index === enqueuedTrackIndex) {
        setEnqueuedTrackIndex(null);
      }
    } else {
      setEnqueuedTracks([]);
      setEnqueuedTrackIndex(null);
    }
  };

  const goNextQueue = () => {
    const nextIndex = (enqueuedTrackIndex ?? -1) + 1;
    if (enqueuedTracks.length > 0 && nextIndex < enqueuedTracks.length) {
      setEnqueuedTrackIndex(nextIndex);
      as.setCurrentTrack(enqueuedTracks[nextIndex]);
    } else {
      if (enqueuedTrackIndex !== null) {
        setEnqueuedTrackIndex(null);
      }
    }
  };

  return {
    enqueuedTracks,
    setEnqueuedTracks,
    enqueuedTrackIndex,
    setEnqueuedTrackIndex,
    enqueueTrack,
    unqueueTrack,
    goNextQueue,
  };
}
