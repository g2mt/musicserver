import TrackList from "./TrackList";
import type { TrackData } from "./TrackData";
import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useRef, useState } from "react";
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
  const [limit, setLimit] = useState(50);

  const updateQuery = (text: string, searchGroup: string = "after|before") => {
    c.setSearchQuery(
      c.searchQuery
        .replace(new RegExp(`\\s*((\\b(${searchGroup}):[^ ]+)|$)`), ` ${text}`)
        .trim(),
    );
    elRef.current?.scrollIntoView({ block: "start" });
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = e.target.value === "unlimited" ? 0 : Number(e.target.value);
    setLimit(newLimit);
    updateQuery(`limit:${newLimit}`, "limit");
  };

  const controls = (
    <div className="main-tracks-controls">
      <div className="main-tracks-controls-left">
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
      <div className="main-tracks-controls-right">
        <select
          className="limit-select"
          value={limit === 0 ? "unlimited" : limit}
          onChange={handleLimitChange}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={150}>150</option>
          <option value="unlimited">unlimited</option>
        </select>
      </div>
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
