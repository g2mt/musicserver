import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { Track } from "./Track";
import { type TrackData } from "./TrackData";
import { AppContext } from "./AppState";
import { faMinus, faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "./TrackList.css";

const PAGE_SIZE = 50;
const TRACK_HEIGHT_PX = 72;

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
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);

  const hasMore = displayedCount < tracks.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayedCount((prev) => Math.min(prev + PAGE_SIZE, tracks.length));
    }
  }, [hasMore, tracks.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: `${TRACK_HEIGHT_PX * 2}px` }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [tracks.length]);

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const scrollTop = list.scrollTop;

    // Only react to scrolling up
    if (scrollTop < lastScrollTop.current) {
      const viewportHeight = list.clientHeight;
      const visibleTracks = Math.floor((scrollTop + viewportHeight) / TRACK_HEIGHT_PX);
      const newCount = Math.max(PAGE_SIZE, visibleTracks + 1);
      setDisplayedCount((prev) => Math.min(prev, newCount));
    }

    lastScrollTop.current = scrollTop;
  }, []);

  const displayedTracks = tracks.slice(0, displayedCount);

  return (
    <div className="track-list" ref={listRef} onScroll={handleScroll}>
      {canUnqueue && (
        <div className="track-list-buttons">
          <button className="btn" onClick={() => c.unqueueTrack()}>
            <FontAwesomeIcon icon={faMinus} />
            Remove all from queue
          </button>
          <button className="btn" onClick={() => {
            const shuffled = [...c.enqueuedTracks];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            c.setEnqueuedTracks(shuffled);
          }}>
            <FontAwesomeIcon icon={faShuffle} />
            Shuffle queue
          </button>
        </div>
      )}

      {displayedTracks.map((track, i) => {
        const index = i;
        return (
          <Track
            key={
              canUnqueue
                ? `${index}-${track.id}`
                : track.id
            }
            track={track}
            index={canUnqueue ? index : undefined}
            canEnqueue={canEnqueue}
            canUnqueue={canUnqueue}
          />
        );
      })}

      {hasMore && <div ref={sentinelRef} style={{ height: "1px" }} />}
    </div>
  );
}

export default TrackList;
