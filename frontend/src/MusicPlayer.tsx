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

export function MusicPlayer() {
  const c = useContext(AppContext)!;
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Navigation

  useEffect(() => {
    window._setIsPlaying = c.as.setIsPlaying;
    window._handleBack = c.queue.prev;
    window._handleForward = c.queue.next;
    return () => {
      window._setIsPlaying = undefined;
      window._handleBack = undefined;
      window._handleForward = undefined;
    };
  }, [c.as.currentTrack, c.queue]);

  // Swipe gestures

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX;
    if (diff < -50) {
      c.queue.prev();
    } else if (diff > 50) {
      c.queue.next();
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
        navigator.mediaSession.setActionHandler("previoustrack", c.queue.prev);
        navigator.mediaSession.setActionHandler("nexttrack", c.queue.next);
        navigator.mediaSession.setActionHandler("stop", null);
      }

      document.title = c.as.currentTrack?.name ?? "Music Player";
    }, [c.as.currentTrack, c.queue]);
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
            {c.queue.canNext() && (
              <ContextMenuItem onClick={c.queue.next} icon={faForwardStep}>
                Forward
              </ContextMenuItem>
            )}
            {c.queue.canPrev() && (
              <ContextMenuItem onClick={c.queue.prev} icon={faBackwardStep}>
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
        max={c.as.duration}
        step={0.1}
        value={c.as.progress}
        onChange={(e) => c.as.setProgress(Number(e.target.value))}
      />
      <div className="player-controls">
        <div className="player-left">
          <button
            className="icon-btn btn-prev-song"
            onClick={c.queue.prev}
            disabled={!c.queue.canPrev()}
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
            onClick={c.queue.next}
            disabled={!c.queue.canNext()}
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
