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
  ended: boolean;
  setEnded: Dispatch<SetStateAction<boolean>>;
}

export function useAudio({ volume , muted } : {volume:number; muted: boolean;}): AudioState {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);

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
    setEnded(false);
  }, [url]);

  useEffect(() => {
    function onTimeUpdate() {
      setProgress(audio.currentTime);
      setDuration(audio.duration);
    }
    function onEnded() {
      setEnded(true);
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack?.id]);

  useEffect(() => {
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  return {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying: (action: boolean | ((prevState: boolean) => boolean)) => {
      setIsPlaying(old => {
        const isPlaying = typeof action === "boolean" ? action: action(old);
        if (isPlaying)
          audio.play();
        else
          audio.pause();
        return isPlaying;
      });
    },
    progress,
    setProgress: (action: number | ((prevState: number) => number)) => {
      setProgress(old => {
        if (typeof action === "number") {
          audio.currentTime = action;
          return action;
        } else {
          audio.currentTime = action(old);
          return action(old);
        }
      });
    },
    duration,
    setDuration,
    ended,
    setEnded,
  };
}
