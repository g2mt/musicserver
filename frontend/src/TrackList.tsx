import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { Track } from "./Track";
import { type TrackData } from "./TrackData";
import { AppContext } from "./AppState";
import { faMinus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "./TrackList.css";

const PAGE_SIZE = 50;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when tracks array changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tracks]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, tracks.length));
  }, [tracks.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const visibleTracks = tracks.slice(0, visibleCount);

  return (
    <div className="track-list">
      {canUnqueue && (
        <button className="btn" onClick={() => c.unqueueTrack()}>
          <FontAwesomeIcon icon={faMinus} />
          Remove all from queue
        </button>
      )}
      {visibleTracks.map((track, index) => (
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
      ))}
      {visibleCount < tracks.length && <div ref={sentinelRef} />}
    </div>
  );
}

export default TrackList;
