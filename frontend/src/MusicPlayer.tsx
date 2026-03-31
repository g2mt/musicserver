import { useEffect, useMemo, useContext, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faVolumeHigh,
  faVolumeXmark,
  faBackwardStep,
  faForwardStep,
} from "@fortawesome/free-solid-svg-icons";
import { getTrackCover, Track } from "./Track";
import { useWindowWidth, PLAYER_COLLAPSE_AT_WIDTH } from "./responsive";
import { AppContext } from "./AppState";
import { getFilePath, getTrackFileFromId } from "./apiserver";
import { apiAudio, useAbsoluteAudioPath } from "./apiaudio";
import { ContextMenuItem, showContextMenu } from "./ContextMenu";

import "./MusicPlayer.css";

declare global {
  interface Window {
    _setIsPlaying?: (_: boolean) => void;
    _handleBack?: () => void;
    _handleForward?: () => void;
  }
}

function useAudio(url: string | null) {
  const audio = useMemo(() => new apiAudio(), []);

  useEffect(() => {
    if (!url) return;
    console.log(`Playing ${url}`);
    audio.src = url;
    audio.currentTime = 0;
    audio.play();
  }, [url]);

  useEffect(() => {
    return () => {
      audio.pause();
    };
  }, [audio]);

  return audio;
}

export function useBackForward() {
  const c = useContext(AppContext)!;

  const isBackDisabled = useMemo(
    () => c.enqueuedTrackIndex === null || c.enqueuedTrackIndex <= 0,
    [c.enqueuedTrackIndex],
  );
  const isForwardDisabled = useMemo(
    () =>
      c.enqueuedTrackIndex === null ||
      c.enqueuedTrackIndex + 1 >= c.enqueuedTracks.length,
    [c.enqueuedTrackIndex, c.enqueuedTracks],
  );

  function handleBack() {
    if (isBackDisabled) return;
    const prevIndex = (c.enqueuedTrackIndex ?? 0) - 1;
    c.setEnqueuedTrackIndex(prevIndex);
    c.setCurrentTrack(c.enqueuedTracks[prevIndex]);
  }

  function handleForward() {
    if (isForwardDisabled) return;
    const nextIndex = (c.enqueuedTrackIndex ?? 0) + 1;
    c.setEnqueuedTrackIndex(nextIndex);
    c.setCurrentTrack(c.enqueuedTracks[nextIndex]);
  }

  return {
    handleBack,
    handleForward,
    isBackDisabled,
    isForwardDisabled,
  };
}

export function MusicPlayer() {
  const c = useContext(AppContext)!;
  const audio = useAudio(
    (() => {
      if (!c.currentTrack) return null;
      // HACK: the audio path cannot be cleanly obtained by the Android audio bridge without
      // without adding additional functions, so use the absolute path directly.
      // the path is checked in NativeAudioBridge
      if (useAbsoluteAudioPath) return `file://${c.currentTrack.path}`;
      if (c.currentTrack.id) return getTrackFileFromId(c.currentTrack.id);
      if (c.currentTrack.path) return getFilePath(c.currentTrack.path);
      return null;
    })(),
  );
  const didUpdatePosition = useRef(false);

  function goNextQueue(doSetIsPlaying: boolean = true) {
    const nextIndex = (c.enqueuedTrackIndex ?? -1) + 1;
    if (c.enqueuedTracks.length > 0 && nextIndex < c.enqueuedTracks.length) {
      c.setEnqueuedTrackIndex(nextIndex);
      c.setCurrentTrack(c.enqueuedTracks[nextIndex]);
    } else {
      // No more tracks in queue
      c.setEnqueuedTrackIndex(null);
      if (doSetIsPlaying) c.setIsPlaying(false);
    }
  }

  useEffect(() => {
    function onTimeUpdate() {
      didUpdatePosition.current = true;
      c.setProgress(audio.currentTime);
      c.setDuration(audio.duration);
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [c.currentTrack?.id]);

  useEffect(() => {
    audio.addEventListener("ended", () => goNextQueue());
    return () => {
      audio.removeEventListener("ended", () => goNextQueue());
    };
  }, [c.enqueuedTracks, c.enqueuedTrackIndex]);

  // Progress

  useEffect(() => {
    if (didUpdatePosition.current) {
      didUpdatePosition.current = false;
      return;
    }
    audio.currentTime = c.progress;
  }, [c.progress]);

  // Play state

  useEffect(() => {
    if (c.currentTrack !== null) {
      c.setProgress(0);
      c.setIsPlaying(true);
    }
  }, [c.currentTrack]);

  useEffect(() => {
    if (c.isPlaying) {
      if (c.currentTrack !== null) {
        audio.play();
      } else {
        goNextQueue(false);
      }
    } else {
      audio.pause();
    }
  }, [c.isPlaying]);

  // Volume

  useEffect(() => {
    audio.volume = c.muted ? 0 : c.volume;
  }, [c.volume, c.muted]);

  // Navigation

  const { handleBack, handleForward, isBackDisabled, isForwardDisabled } =
    useBackForward();

  useEffect(() => {
    window._setIsPlaying = c.setIsPlaying;
    window._handleBack = handleBack;
    window._handleForward = handleForward;
    return () => {
      window._setIsPlaying = undefined;
      window._handleBack = undefined;
      window._handleForward = undefined;
    };
  }, [c.currentTrack, c.enqueuedTracks, c.enqueuedTrackIndex]);

  // Media info

  if ("mediaSession" in navigator) {
    useEffect(() => {
      if (c.currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: c.currentTrack.name,
          artist: c.currentTrack.artist,
          album: c.currentTrack.album,
          artwork: [{ src: getTrackCover(c.currentTrack) }],
        });

        navigator.mediaSession.setActionHandler("play", () =>
          c.setIsPlaying(true),
        );
        navigator.mediaSession.setActionHandler("pause", () =>
          c.setIsPlaying(false),
        );
        navigator.mediaSession.setActionHandler("previoustrack", handleBack);
        navigator.mediaSession.setActionHandler("nexttrack", handleForward);
        navigator.mediaSession.setActionHandler("stop", null);
      }

      document.title = c.currentTrack?.name ?? "Music Player";
    }, [c.currentTrack, c.enqueuedTracks, c.enqueuedTrackIndex]);
  }

  const windowWidth = useWindowWidth();
  const collapsed = windowWidth < PLAYER_COLLAPSE_AT_WIDTH;

  return (
    <div
      className={`music-player ${collapsed ? "collapsed" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        showContextMenu(
          e.currentTarget,
          <>
            <ContextMenuItem
              onClick={() => c.setIsPlaying && c.setIsPlaying((p) => !p)}
              icon={c.isPlaying ? faPause : faPlay}
            >
              {c.isPlaying ? "Pause" : "Play"}
            </ContextMenuItem>
            {!isForwardDisabled && (
              <ContextMenuItem onClick={handleForward} icon={faForwardStep}>
                Forward
              </ContextMenuItem>
            )}
            {!isBackDisabled && (
              <ContextMenuItem onClick={handleBack} icon={faBackwardStep}>
                Backward
              </ContextMenuItem>
            )}
          </>,
        );
      }}
    >
      <input
        className="scrubber-bar"
        type="range"
        min={0}
        max={c.duration || 0}
        step={0.1}
        value={c.progress}
        onChange={(e) => c.setProgress(Number(e.target.value))}
      />
      <div className="player-controls">
        <div className="player-left">
          <button
            className="icon-btn btn-prev-song"
            onClick={handleBack}
            disabled={isBackDisabled}
          >
            <FontAwesomeIcon icon={faBackwardStep} />
          </button>
          <button
            className="icon-btn btn-play-pause"
            onClick={() => c.setIsPlaying && c.setIsPlaying((p) => !p)}
          >
            <FontAwesomeIcon icon={c.isPlaying ? faPause : faPlay} />
          </button>
          <button
            className="icon-btn btn-next-song"
            onClick={handleForward}
            disabled={isForwardDisabled}
          >
            <FontAwesomeIcon icon={faForwardStep} />
          </button>
        </div>
        <div className="player-center">
          {c.currentTrack && <Track track={c.currentTrack} />}
        </div>
        <div className="player-right">
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={c.muted ? 0 : c.volume}
            onChange={(e) => {
              if (c.setVolume) c.setVolume(Number(e.target.value));
              if (c.setMuted) c.setMuted(false);
            }}
          />
          <button
            className="icon-btn"
            onClick={() => c.setMuted && c.setMuted((m) => !m)}
          >
            <FontAwesomeIcon
              icon={c.muted || c.volume === 0 ? faVolumeXmark : faVolumeHigh}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
