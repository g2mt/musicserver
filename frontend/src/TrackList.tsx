import {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
} from "react";
import { Track } from "./Track";
import { type TrackData } from "./TrackData";
import { AppContext } from "./AppState";
import { faMinus, faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "./TrackList.css";

const PAGE_SIZE = 50;
const TRACK_HEIGHT_PX = 72;

export function useTrackList({
  tracks,
  canEnqueue,
  canUnqueue,
  parentElement,
}: {
  tracks: TrackData[];
  canEnqueue?: boolean;
  canUnqueue?: boolean;
  parentElement: RefObject<HTMLElement | null>;
}) {
  const c = useContext(AppContext)!;
  const listRef = useRef<HTMLDivElement>(null);

  // Displayed count

  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [tracks.length]);

  const displayedTracks = tracks.slice(0, displayedCount);

  // Scroll event decreasing setDisplayedCount for scrolling up

  const lastScrollTop = useRef(0);

  useEffect(() => {
    const pe = parentElement.current;
    if (!pe) return;

    const handleScroll = () => {
      const scrollTop = pe.scrollTop;
      if (scrollTop < lastScrollTop.current) {
        const visibleStart = Math.floor(scrollTop / TRACK_HEIGHT_PX);
        setDisplayedCount(Math.max(visibleStart + PAGE_SIZE, PAGE_SIZE));
      }
      lastScrollTop.current = scrollTop;
    };

    pe.addEventListener("scroll", handleScroll);
    return () => pe.removeEventListener("scroll", handleScroll);
  }, [parentElement.current]);

  // Sentinel for scrolling down

  const sentinelRef = useRef<HTMLDivElement>(null);
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
      { rootMargin: `${TRACK_HEIGHT_PX * 2}px` },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Scrolling functions

  const scrollToTrack = (index: number) => {
    const pe = parentElement.current;
    if (!pe) return;
    pe.scrollTop = index * TRACK_HEIGHT_PX;
  };

  const el = (
    <div className="track-list" ref={listRef}>
      {canUnqueue && (
        <div className="track-list-buttons">
          <button className="btn" onClick={() => c.unqueueTrack()}>
            <FontAwesomeIcon icon={faMinus} />
            Remove all from queue
          </button>
          <button
            className="btn"
            onClick={() => {
              const shuffled = [...c.enqueuedTracks];
              for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
              }
              c.setEnqueuedTracks(shuffled);
            }}
          >
            <FontAwesomeIcon icon={faShuffle} />
            Shuffle queue
          </button>
        </div>
      )}

      {displayedTracks.map((track, i) => {
        const index = i;
        return (
          <Track
            key={canUnqueue ? `${index}-${track.id}` : track.id}
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

  return { el, scrollToTrack };
}
