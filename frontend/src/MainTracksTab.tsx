import TrackList from "./TrackList";
import type { TrackData } from "./TrackData";
import {
  faChevronLeft,
  faChevronRight,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useRef } from "react";
import { AppContext } from "./AppState";
import { Select, Option } from "./Select";

import "./MainTracksTab.css";

export function MainTracksTab({ tracks }: { tracks: TrackData[] | null }) {
  if (tracks === null || tracks.length === 0) {
    return <div className="main-tracks-controls">No tracks found</div>;
  }

  const c = useContext(AppContext)!;
  const firstTrack = tracks[0];
  const lastTrack = tracks[tracks.length - 1];
  const elRef = useRef<HTMLDivElement | null>(null);

  const updateQuery = (text: string, searchGroup: string = "after|before") => {
    c.oldSearchQuery.current = c.searchQuery;
    c.setSearchQuery(
      c.searchQuery
        .replace(new RegExp(`\\s*((\\b(${searchGroup}):[^ ]+)|$)`), ` ${text}`)
        .trim(),
    );
    elRef.current?.scrollIntoView({ block: "start" });
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const newLimit = Number(e.target.value);
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
          onClick={() =>
            lastTrack && updateQuery(`after:${lastTrack.short_id}`)
          }
          disabled={!lastTrack}
          title="Next"
        >
          <FontAwesomeIcon icon={faChevronRight} />
          Forward
        </button>
      </div>
      <div className="main-tracks-controls-right">
        <Select value="" onChange={handleLimitChange}>
          <Option value={50} onClick={() => {}}>
            50
          </Option>
          <Option value={100} onClick={() => {}}>
            100
          </Option>
          <Option value={150} onClick={() => {}}>
            150
          </Option>
          <Option value={-1} onClick={() => {}}>
            unlimited
          </Option>
        </Select>
        <button className="btn" onClick={() => c.enqueueTrack(tracks)}>
          <FontAwesomeIcon icon={faPlus} />
          Add all to queue
        </button>
      </div>
    </div>
  );

  return (
    <div className="main-tracks-tab" ref={elRef}>
      {controls}
      <TrackList tracks={tracks} canEnqueue={true} />
      {controls}
    </div>
  );
}
