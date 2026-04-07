import { useEffect, useMemo, useContext, useState } from "react";
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
import { useWindowWidth, COLLAPSE_AT_WIDTH } from "./responsive";
import { AppContext } from "./AppState";
import { ContextMenuItem, toggleContextMenu } from "./ContextMenu";

import "./MusicPlayer.css";

declare global {
  interface Window {
    _setIsPlaying?: (_: boolean) => void;
    _handleBack?: () => void;
    _handleForward?: () => void;
  }
}

export function useBackForward() {
  const c = useContext(AppContext)!;

  const isBackDisabled = useMemo(
    () => c.enqueuedTrackIndex === null || c.enqueuedTrackIndex <= 0,
    [c.enqueuedTrackIndex],
  );
  const isForwardDisabled = useMemo(
    () =>
      (typeof c.enqueuedTrackIndex ===
        "number" /* for tracks inside of queue */ &&
        c.enqueuedTrackIndex + 1 >= c.enqueuedTracks.length) ||
      c.enqueuedTracks.length === 0 /* for tracks outside of queue */,
    [c.enqueuedTrackIndex, c.enqueuedTracks],
  );

  function handleBack() {
    const prevIndex = (c.enqueuedTrackIndex ?? 1) - 1;
    if (typeof c.enqueuedTracks[prevIndex] === "undefined") return;
    c.setEnqueuedTrackIndex(prevIndex);
    c.as.setCurrentTrack(c.enqueuedTracks[prevIndex]);
    c.trackQueueScroll(prevIndex);
  }

  function handleForward() {
    const nextIndex = (c.enqueuedTrackIndex ?? -1) + 1;
    if (typeof c.enqueuedTracks[nextIndex] === "undefined") return;
    c.setEnqueuedTrackIndex(nextIndex);
    c.as.setCurrentTrack(c.enqueuedTracks[nextIndex]);
    c.trackQueueScroll(nextIndex);
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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    c.as.addEventListener("ended", () => goNextQueue());
    return () => {
      c.as.removeEventListener("ended", () => goNextQueue());
    };
  }, [c.enqueuedTracks, c.enqueuedTrackIndex]);

  // Play state

  useEffect(() => {
    c.as.setProgress(0);
    if (c.as.currentTrack !== null) {
      c.as.setIsPlaying(true);
    } else {
      c.as.setIsPlaying(false);
    }
  }, [c.as.currentTrack]);

  useEffect(() => {
    if (c.as.isPlaying) {
      if (c.as.currentTrack !== null) {
        c.as.play();
      } else {
        c.goNextQueue(false);
      }
    } else {
      c.as.pause();
    }
  }, [c.as.isPlaying]);

  // Volume

  useEffect(() => {
    c.as.volume = c.muted ? 0 : c.volume;
  }, [c.volume, c.muted]);

  // Navigation

  const { handleBack, handleForward, isBackDisabled, isForwardDisabled } =
    useBackForward();

  useEffect(() => {
    window._setIsPlaying = c.as.setIsPlaying;
    window._handleBack = handleBack;
    window._handleForward = handleForward;
    return () => {
      window._setIsPlaying = undefined;
      window._handleBack = undefined;
      window._handleForward = undefined;
    };
  }, [c.as.currentTrack, c.enqueuedTracks, c.enqueuedTrackIndex]);

  // Swipe gestures

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX;
    if (diff < -50) {
      handleBack();
    } else if (diff > 50) {
      handleForward();
    }
    setTouchStartX(null);
  }

  // Media info

  if ("mediaSession" in navigator) {
    useEffect(() => {
      if (c.as.currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: c.as.currentTrack.name,
          artist: c.as.currentTrack.artist,
          album: c.as.currentTrack.album,
          artwork: [{ src: getTrackCover(c.as.currentTrack) }],
        });

        navigator.mediaSession.setActionHandler("play", () =>
          c.as.setIsPlaying(true),
        );
        navigator.mediaSession.setActionHandler("pause", () =>
          c.as.setIsPlaying(false),
        );
        navigator.mediaSession.setActionHandler("previoustrack", handleBack);
        navigator.mediaSession.setActionHandler("nexttrack", handleForward);
        navigator.mediaSession.setActionHandler("stop", null);
      }

      document.title = c.as.currentTrack?.name ?? "Music Player";
    }, [c.as.currentTrack, c.enqueuedTracks, c.enqueuedTrackIndex]);
  }

  const windowWidth = useWindowWidth();
  const collapsed = windowWidth < COLLAPSE_AT_WIDTH;

  return (
    <div
      className={`music-player ${collapsed ? "collapsed" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        toggleContextMenu(
          e.currentTarget,
          <>
            <ContextMenuItem
              onClick={() => c.as.setIsPlaying && c.as.setIsPlaying((p) => !p)}
              icon={c.as.isPlaying ? faPause : faPlay}
            >
              {c.as.isPlaying ? "Pause" : "Play"}
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
        max={c.as.duration || 0}
        step={0.1}
        value={c.as.progress}
        onChange={(e) => c.as.setProgress(Number(e.target.value))}
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
            onClick={() => c.as.setIsPlaying && c.as.setIsPlaying((p) => !p)}
          >
            <FontAwesomeIcon icon={c.as.isPlaying ? faPause : faPlay} />
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
          {c.as.currentTrack && <Track track={c.as.currentTrack} />}
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
