import { useTrackList } from "./TrackList";
import type { TrackData } from "./TrackData";
import {
  faChevronLeft,
  faChevronRight,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useRef, type RefObject } from "react";
import { AppContext } from "./AppState";
import { Select, Option } from "./Select";
import { ContextMenuItem, toggleContextMenu } from "./ContextMenu";
import { fetchAPI } from "./apiServer";
import { toast } from "react-toastify";

import "./MainTracksTab.css";

export function MainTracksTab({
  tracks,
  parentElement,
}: {
  tracks: TrackData[] | null;
  parentElement: RefObject<HTMLElement | null>;
}) {
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

  const handleAddAllToQueue = () => {
    fetchAPI("/track", { q: `${c.searchQuery} limit:-1` })
      .then((data) => {
        if (data === null || data.length === 0) {
          toast.warn(<>No tracks found</>);
        } else {
          if (c.showOnlyQueueAfterEnqueue) {
            c.setTracksListCollapsed(true);
            c.setQueueCollapsed(false);
          }
          c.queue.add(data);
        }
      })
      .catch((e) => {
        toast.error(<>Error loading: {e.toString()}</>);
      });
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
          <span>Back</span>
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
          <span>Forward</span>
        </button>
      </div>
      <div className="main-tracks-controls-right">
        <Select onChange={handleLimitChange}>
          <Option value="" disabled={true}>
            limit
          </Option>
          <Option value={50}>50</Option>
          <Option value={100}>100</Option>
          <Option value={150}>150</Option>
          <Option value={-1}>unlimited</Option>
        </Select>
        <button
          className="btn"
          onClick={() => {
            if (c.showOnlyQueueAfterEnqueue) {
              c.setTracksListCollapsed(true);
              c.setQueueCollapsed(false);
            }
            c.queue.add(tracks);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            toggleContextMenu(
              e.currentTarget,
              <>
                <ContextMenuItem onClick={handleAddAllToQueue}>
                  Add all to queue
                </ContextMenuItem>
              </>,
            );
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
          Add visible to queue
        </button>
      </div>
    </div>
  );

  return (
    <div className="main-tracks-tab" ref={elRef}>
      {controls}
      {
        useTrackList({
          tracks,
          canEnqueue: true,
          parentElement,
          queue: c.queue,
        })
      }
      {controls}
    </div>
  );
}
