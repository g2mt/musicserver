import { TrackList } from "./TrackList";
import type { TrackData } from "./TrackData";
import {
  faChevronLeft,
  faChevronRight,
  faPlay,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useRef, type RefObject } from "react";
import { AppContext } from "./AppState";
import { Select, Option } from "./Select";
import { ContextMenuItem, toggleContextMenu } from "./ContextMenu";
import { fetchAPI } from "./apiServer";
import { toast } from "react-toastify";
import { shuffled } from "./utils";

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
    c.setSearchQuery((old) => ({
      ...old,
      q: old.q
        .replace(new RegExp(`\\s*((\\b(${searchGroup}):[^ ]+)|$)`), ` ${text}`)
        .trim(),
    }));
    elRef.current?.scrollIntoView({ block: "start" });
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const newLimit = Number(e.target.value);
    c.setSearchQuery({
      q: c.searchQuery.q,
      limit: newLimit,
    });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const newSort = e.target.value;
    updateQuery(newSort ? `sort:${newSort}` : "", "sort");
  };

  const handlePlayAll = () => {
    fetchAPI("/track", { q: c.searchQuery.q, limit: "-1" })
      .then((tracks) => {
        if (tracks === null || tracks.length === 0) {
          toast.warn(<>No tracks found</>);
        } else {
          if (c.showOnlyQueueAfterEnqueue) {
            c.setTracksListCollapsed(true);
            c.setQueueCollapsed(false);
          }
          const tracksToPlay = c.shuffleBeforePlayingAll
            ? shuffled(tracks)
            : tracks;
          c.queue.setTracks(tracksToPlay);
          c.queue.setTrackNavigated(true);
          c.queue.setIndex(0);
          c.as.setCurrentTrack(tracksToPlay[0]);
        }
      })
      .catch((e) => {
        toast.error(<>Error loading tracks: {e.toString()}</>);
      });
  };

  const handleAddAllToQueue = () => {
    fetchAPI("/track", { q: c.searchQuery.q, limit: "-1" })
      .then((tracks) => {
        if (tracks === null || tracks.length === 0) {
          toast.warn(<>No tracks found</>);
        } else {
          if (c.showOnlyQueueAfterEnqueue) {
            c.setTracksListCollapsed(true);
            c.setQueueCollapsed(false);
          }
          c.queue.add(tracks);
        }
      })
      .catch((e) => {
        toast.error(<>Error loading tracks: {e.toString()}</>);
      });
  };

  const handleAddVisibleToQueue = () => {
    if (c.showOnlyQueueAfterEnqueue) {
      c.setTracksListCollapsed(true);
      c.setQueueCollapsed(false);
    }
    c.queue.add(tracks);
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
        <Select onChange={handleSortChange}>
          <Option value="id">ID</Option>
          <Option value="name">Name</Option>
          <Option value="path">Path</Option>
          <Option value="artist">Artist</Option>
          <Option value="album">Album</Option>
        </Select>
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
          onClick={handlePlayAll}
          onContextMenu={(e) => {
            e.preventDefault();
            toggleContextMenu(
              e.currentTarget,
              <>
                <ContextMenuItem onClick={handleAddVisibleToQueue}>
                  <FontAwesomeIcon icon={faPlus} />
                  Add visible to queue
                </ContextMenuItem>
                <ContextMenuItem onClick={handleAddAllToQueue}>
                  <FontAwesomeIcon icon={faPlus} />
                  Add all to queue
                </ContextMenuItem>
              </>,
            );
          }}
        >
          <FontAwesomeIcon icon={faPlay} />
          Play all
        </button>
      </div>
    </div>
  );

  return (
    <div className="main-tracks-tab" ref={elRef}>
      {controls}
      <TrackList
        tracks={tracks}
        parentElement={parentElement}
        act={"enqueue"}
        queue={c.queue}
      />
      {controls}
    </div>
  );
}
