import { useState, useMemo, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import type { TrackData } from "./TrackData";
import { apiAudio, useAbsoluteAudioPath } from "./apiAudio";
import { fetchAPI, getFilePath, getTrackFileFromId } from "./apiServer";

export interface SerializedAudioState {
  path: string; // get the track using the `/track/:by-path` endpoint
  isPlaying: boolean;
  progress: number;
  duration: number;
}

export interface AudioState {
  currentTrack: TrackData | null;
  setCurrentTrack: Dispatch<SetStateAction<TrackData | null>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  playRequestedWithoutTrack: boolean; // signal to request next audio in queue (see App.tsx)
  setPlayRequestedWithoutTrack: Dispatch<SetStateAction<boolean>>;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
  duration: number;
  setDuration: Dispatch<SetStateAction<number>>;
  ended: RefObject<boolean>; // ended signal to request next audio in queue (see App.tsx)
  repeated: RefObject<boolean>; // signal request the current audio again
  loadSerializedState: (state: SerializedAudioState) => Promise<void>;
}

export function useAudio({
  volume,
  muted,
}: {
  volume: number;
  muted: boolean;
}): AudioState {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playRequestedWithoutTrack, setPlayRequestedWithoutTrack] =
    useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const ended = useRef(false);
  const repeated = useRef(false);

  const audio = useMemo(() => new apiAudio(), []);

  const url = useMemo(() => {
    if (!currentTrack) return null;
    // HACK: the audio path cannot be cleanly obtained by the Android audio bridge without
    // without adding additional functions, so use the absolute path directly.
    // the path is checked in NativeAudioBridge
    if (currentTrack.path && useAbsoluteAudioPath)
      return `file://${encodeURI(currentTrack.path)}`;
    if (currentTrack.id) return getTrackFileFromId(currentTrack.id);
    if (currentTrack.path) return getFilePath(currentTrack.path);
    return null;
  }, [currentTrack]);

  useEffect(() => {
    if (!url) {
      setIsPlaying(false);
      return;
    }
    console.log(`Playing ${url}`);
    audio.src = url;
    audio.currentTime = 0;
    setProgress(0);
    setDuration(audio.duration);
    setIsPlaying(true);
    ended.current = false;
    repeated.current = false;
  }, [url]);

  useEffect(() => {
    function onTimeUpdate() {
      setProgress(audio.currentTime);
      setDuration(audio.duration);
    }
    function onEnded() {
      setProgress(audio.duration);
      ended.current = true;
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack]);

  useEffect(() => {
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    // auto play or pause based on state
    if (repeated.current) {
      repeated.current = false;
    }
    if (isPlaying) {
      if (url === null) {
        setIsPlaying(false);
        setPlayRequestedWithoutTrack(true);
      } else {
        audio.play();
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, url, repeated.current /* triggers when repeated */]);

  return {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    playRequestedWithoutTrack,
    setPlayRequestedWithoutTrack,
    progress,
    setProgress: (action: number | ((prevState: number) => number)) => {
      setProgress((old) => {
        const progress = typeof action === "number" ? action : action(old);
        audio.currentTime = progress;
        return progress;
      });
    },
    duration,
    setDuration,
    ended,
    repeated,
    loadSerializedState: async (state: SerializedAudioState) => {
      if (state.path !== "") {
        const data = await fetchAPI(`/track/:by-path/${encodeURI(state.path)}`);
        if (data && !data.error) {
          if (data.path !== currentTrack?.path)
            setCurrentTrack(data);
        } else {
          console.error(`Invalid loadSerializedState: ${data}`);
          return;
        }
      } else {
        setCurrentTrack(null);
      }
      setIsPlaying(state.isPlaying);
      setPlayRequestedWithoutTrack(false);
      setProgress(state.progress);
      setDuration(state.duration);
      ended.current = false;
    },
  };
}
