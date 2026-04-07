import { useState, useMemo, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TrackData } from "./TrackData";
import { apiAudio, useAbsoluteAudioPath } from "./apiAudio";
import { getFilePath, getTrackFileFromId } from "./apiServer";

export interface AudioState {
  currentTrack: TrackData | null;
  setCurrentTrack: Dispatch<SetStateAction<TrackData | null>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
  duration: number;
  setDuration: Dispatch<SetStateAction<number>>;
}

export function useAudio(): AudioState {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const audio = useMemo(() => new apiAudio(), []);

  const url = useMemo(() => {
    if (!currentTrack) return null;
    // HACK: the audio path cannot be cleanly obtained by the Android audio bridge without
    // without adding additional functions, so use the absolute path directly.
    // the path is checked in NativeAudioBridge
    if (useAbsoluteAudioPath) return `file://${currentTrack.path}`;
    if (currentTrack.id) return getTrackFileFromId(currentTrack.id);
    if (currentTrack.path) return getFilePath(currentTrack.path);
    return null;
  }, [currentTrack]);

  useEffect(() => {
    if (!url) return;
    console.log(`Playing ${url}`);
    audio.src = url;
    audio.currentTime = 0;
    if (isPlaying) {
      audio.play();
    }
  }, [url]);

  useEffect(() => {
    function onTimeUpdate() {
      setProgress(audio.currentTime);
      setDuration(audio.duration);
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [currentTrack?.id]);

  return {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    progress,
    setProgress: (action: number | ((prevState: number) => number)) => {
      setProgress(progress => {
        if (typeof action === "number") {
          audio.currentTime = action;
          return action;
        } else {
          audio.currentTime = action(progress);
          return action(progress);
        }
      });
    },
    duration,
    setDuration,
  };
}
