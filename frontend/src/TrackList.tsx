import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { Track } from "./Track";
import { type TrackData } from "./TrackData";
import { AppContext } from "./AppState";
import { faMinus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "./TrackList.css";

const PAGE_SIZE = 50;
const TRACK_HEIGHT_PX = 72; // approximate height of a single track row in pixels

function TrackList({
  tracks,
  canEnqueue,
  canUnqueue,
}: {
  tracks: TrackData[];
  canEnqueue?: boolean;
  canUnqueue?: boolean;
}) {
  const c = useContext(AppContext)!;

  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(PAGE_SIZE);

  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Reset window when tracks array changes
  useEffect(() => {
    setStartIndex(0);
    setEndIndex(PAGE_SIZE);
  }, [tracks]);

  const loadMore = useCallback(() => {
    setEndIndex((prev) => Math.min(prev + PAGE_SIZE, tracks.length));
    setStartIndex((prev) => Math.max(0, prev - PAGE_SIZE));
  }, [tracks.length]);

  const loadPrev = useCallback(() => {
    setStartIndex((prev) => Math.max(0, prev - PAGE_SIZE));
    setEndIndex((prev) => Math.min(prev + PAGE_SIZE, tracks.length));
  }, [tracks.length]);

  useEffect(() => {
    const bottomSentinel = bottomSentinelRef.current;
    if (!bottomSentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(bottomSentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const topSentinel = topSentinelRef.current;
    if (!topSentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadPrev();
      },
      { threshold: 0.1 }
    );
    observer.observe(topSentinel);
    return () => observer.disconnect();
  }, [loadPrev]);

  const clampedEnd = Math.min(endIndex, tracks.length);
  const visibleTracks = tracks.slice(startIndex, clampedEnd);

  const topPlaceholderHeight = startIndex * TRACK_HEIGHT_PX;
  const bottomPlaceholderHeight = (tracks.length - clampedEnd) * TRACK_HEIGHT_PX;

  return (
    <div className="track-list">
      {canUnqueue && (
        <button className="btn" onClick={() => c.unqueueTrack()}>
          <FontAwesomeIcon icon={faMinus} />
          Remove all from queue
        </button>
      )}

      {/* Top placeholder preserves scroll position for unloaded upper tracks */}
      {topPlaceholderHeight > 0 && (
        <div style={{ height: topPlaceholderHeight }} />
      )}

      {/* Sentinel to detect scrolling back up */}
      {startIndex > 0 && <div ref={topSentinelRef} />}

      {visibleTracks.map((track, i) => {
        const index = startIndex + i;
        return (
          <Track
            key={
              canUnqueue
                ? `${index}-${track.id}`
                : track.id
            } /* queued items have order */
            track={track}
            index={canUnqueue ? index : undefined}
            canEnqueue={canEnqueue}
            canUnqueue={canUnqueue}
          />
        );
      })}

      {/* Sentinel to detect scrolling down */}
      {clampedEnd < tracks.length && <div ref={bottomSentinelRef} />}

      {/* Bottom placeholder preserves scroll position for unloaded lower tracks */}
      {bottomPlaceholderHeight > 0 && (
        <div style={{ height: bottomPlaceholderHeight }} />
      )}
    </div>
  );
}

export default TrackList;
