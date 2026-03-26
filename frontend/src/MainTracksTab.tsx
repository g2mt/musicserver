import TrackList from "./TrackList";
import type { TrackData } from "./Track";
import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useRef } from "react";
import { AppContext } from "./AppState";

import "./MainTracksTab.css";

export function MainTracksTab({ tracks }: { tracks: TrackData[] | null }) {
  if (tracks === null || tracks.length === 0) {
    return <div className="main-tracks-controls">No tracks found</div>;
  }

  const c = useContext(AppContext)!;
  const firstTrack = tracks[0];
  const lastTrack = tracks[tracks.length - 1];
  const elRef = useRef<HTMLDivElement | null>(null);
  const updateQuery = (text: string) => {
    c.setSearchQuery(
      c.searchQuery
        .replace(/ *((\b(after|before):[^ ]+)|$)/, ` ${text}`)
        .trim(),
    );
    elRef.current?.scrollIntoView({ block: "start" });
  };

  const controls = (
    <div className="main-tracks-controls">
      <button
        className="btn"
        onClick={() =>
          firstTrack && updateQuery(`before:${firstTrack.short_id}`)
        }
        disabled={!firstTrack}
        title="Previous"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
        Back
      </button>
      <button
        className="btn"
        onClick={() => lastTrack && updateQuery(`after:${lastTrack.short_id}`)}
        disabled={!lastTrack}
        title="Next"
      >
        <FontAwesomeIcon icon={faChevronRight} />
        Forward
      </button>
    </div>
  );

  return (
    <div className="main-tracks-tab" ref={elRef}>
      {controls}
      <TrackList tracks={tracks} enqueueTrack={c.enqueueTrack} />
      {controls}
    </div>
  );
}
