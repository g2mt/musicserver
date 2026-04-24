import { faMinus, faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Track } from "src/Track";
import { type TrackData } from "src/TrackData";
import type { TrackQueue } from "src/TrackQueue";
import { type OptionalUnion, shuffled } from "src/utils";

import "./TrackList.css";

const PAGE_SIZE = 50;
const TRACK_HEIGHT_PX = 72;

type TrackListContainerProps = OptionalUnion<
  | {
      act: "enqueue";
      queue: TrackQueue;
    }
  | {
      act: "unqueue";
      queue: TrackQueue;
    }
>;

export type TrackListProps = {
  tracks: TrackData[];
  parentElement: RefObject<HTMLElement | null>;
} & TrackListContainerProps;

export function TrackList(props: TrackListProps) {
  const { tracks, parentElement } = props;

  const listRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scrolling functions

  const [trackScrolled, scrollToTrack] = useState(-1);
  const trackScrollChanged = useRef(false);

  useEffect(() => {
    if (trackScrolled < 0) return;
    if (trackScrolled > displayedCount) {
      setDisplayedCount(trackScrolled + PAGE_SIZE);
      trackScrollChanged.current = true; // delay scrollIntoView until next render
    } else {
      trackRefs.current[trackScrolled]?.scrollIntoView();
    }
  }, [trackScrolled]);

  useEffect(() => {
    if (trackScrollChanged.current && trackRefs.current[trackScrolled]) {
      trackScrollChanged.current = false;
      trackRefs.current[trackScrolled]?.scrollIntoView();
    }
  }, [trackScrollChanged.current, trackRefs.current[trackScrolled]]);

  useEffect(() => {
    // Only scroll the queue
    if (
      props.act === "unqueue" &&
      props.queue.trackNavigated &&
      props.queue.index !== null
    ) {
      scrollToTrack(props.queue.index);
      props.queue.setTrackNavigated(false);
    }
  }, [props.act === "unqueue" && props.queue.trackNavigated]);

  // Displayed count

  const [displayedCount, setDisplayedCount] = useState(
    trackScrolled + PAGE_SIZE,
  );

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
        setDisplayedCount(
          Math.max(visibleStart + PAGE_SIZE, trackScrolled + PAGE_SIZE),
        );
      }
      lastScrollTop.current = scrollTop;
    };

    pe.addEventListener("scroll", handleScroll);
    return () => pe.removeEventListener("scroll", handleScroll);
  }, [parentElement.current, trackScrolled]);

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

  return (
    <div className="track-list" ref={listRef}>
      {props.act === "unqueue" && (
        <div className="track-list-buttons">
          <button className="btn" onClick={() => props.queue.remove()}>
            <FontAwesomeIcon icon={faMinus} />
            Remove all from queue
          </button>
          <button
            className="btn"
            onClick={() => props.queue.setTracks(shuffled(tracks))}
          >
            <FontAwesomeIcon icon={faShuffle} />
            Shuffle queue
          </button>
        </div>
      )}

      {displayedTracks.map((track, index) => (
        <div
          key={props.act === "unqueue" ? `${index}-${track.id}` : track.id}
          ref={(el) => {
            trackRefs.current[index] = el;
          }}
        >
          <Track
            track={track}
            index={props.act === "unqueue" ? index : undefined}
            act={props.act}
          />
        </div>
      ))}

      {hasMore && <div ref={sentinelRef} style={{ height: "1px" }} />}
    </div>
  );
}
