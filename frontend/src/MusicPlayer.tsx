import { useEffect, useContext, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faVolumeHigh,
  faVolumeXmark,
  faBackwardStep,
  faForwardStep,
  faRepeat,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { getTrackCover, Track } from "./Track";
import { useWindowWidth, COLLAPSE_AT_WIDTH } from "./responsive";
import { AppContext } from "./AppState";
import { ContextMenuItem, toggleContextMenu } from "./ContextMenu";

import "./MusicPlayer.css";

export function MusicPlayer() {
  const c = useContext(AppContext)!;
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

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
            <ContextMenuItem disabled={true}>Repeat...</ContextMenuItem>
            <ContextMenuItem
              onClick={() => c.queue.setRepeat("track")}
              icon={faRepeat}
              highlighted={c.queue.repeat === "track"}
            >
              Track
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => c.queue.setRepeat("queue")}
              icon={faRepeat}
              highlighted={c.queue.repeat === "queue"}
            >
              Queue
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => c.queue.setRepeat(null)}
              icon={faXmark}
              highlighted={c.queue.repeat === null}
            >
              No repeat
            </ContextMenuItem>
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
      <div className="player-controls" // Touch only affects controls
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="player-left">
          <button
            className="icon-btn btn-prev-song"
            onClick={c.queue.prev}
            disabled={!c.queue.canPrev()}
            title="Previous track"
          >
            <FontAwesomeIcon icon={faBackwardStep} />
          </button>
          <button
            className="icon-btn btn-play-pause"
            onClick={() => c.as.setIsPlaying && c.as.setIsPlaying((p) => !p)}
            title={c.as.isPlaying ? "Pause" : "Play"}
          >
            <FontAwesomeIcon icon={c.as.isPlaying ? faPause : faPlay} />
          </button>
          <button
            className="icon-btn btn-next-song"
            onClick={c.queue.next}
            disabled={!c.queue.canNext()}
            title="Next track"
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
          <button
            className="icon-btn btn-repeat"
            onClick={() => {
              const next =
                c.queue.repeat === null
                  ? "track"
                  : c.queue.repeat === "track"
                    ? "queue"
                    : null;
              c.queue.setRepeat(next);
            }}
            title={
              c.queue.repeat === "track"
                ? "Repeat track"
                : c.queue.repeat === "queue"
                  ? "Repeat queue"
                  : "Repeat off"
            }
          >
            <FontAwesomeIcon
              icon={faRepeat}
              style={{ opacity: c.queue.repeat ? 1 : 0.5 }}
            />
            {c.queue.repeat && (
              <span className="repeat-badge">
                {c.queue.repeat === "track" ? "Track" : "Queue"}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
