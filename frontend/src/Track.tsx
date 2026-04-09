import { useContext } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faMinus,
  faPlay,
  faCopy,
  faCompactDisc,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { getTrackCoverFromId, getTrackCoverFromPath } from "./apiServer";
import { AppContext } from "./AppState";
import { toggleContextMenu, ContextMenuItem } from "./ContextMenu";
import type { TrackData } from "./TrackData";

import "./Track.css";

export function getTrackCover(track: TrackData): string {
  if (window._native) {
    return getTrackCoverFromPath(track.path);
  }
  return track.thumbnail_path ?? getTrackCoverFromId(track.short_id);
}

export function Track({
  track,
  highlighted,
  index,
  canEnqueue,
  canUnqueue,
}: {
  track: TrackData;
  highlighted?: boolean;
  index?: number;
  canEnqueue?: boolean;
  canUnqueue?: boolean;
}) {
  const c = useContext(AppContext)!;
  const isHighlighted =
    highlighted || (index !== undefined && index === c.queue.index);
  return (
    <div className={`track ${isHighlighted ? "highlighted" : ""}`}>
      <img
        className="track-cover"
        src={getTrackCover(track)}
        onClick={(e) => {
          toggleContextMenu(
            e.currentTarget,
            <>
              <ContextMenuItem
                icon={faPlay}
                onClick={() => {
                  if (index !== undefined) c.queue.setIndex(index);
                  c.as.setCurrentTrack(track);
                }}
              >
                Play
              </ContextMenuItem>
              <ContextMenuItem
                icon={faCopy}
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${track.name} - ${track.artist}`,
                  );
                }}
              >
                Copy info
              </ContextMenuItem>
              <ContextMenuItem disabled={true}>Go to...</ContextMenuItem>
              {track.album !== "" && (
                <ContextMenuItem
                  icon={faCompactDisc}
                  onClick={() => {
                    c.setSearchQuery(`album:"${track.album}"`);
                  }}
                >
                  Album
                </ContextMenuItem>
              )}
              {track.artist !== "" && (
                <ContextMenuItem
                  icon={faUser}
                  onClick={() => {
                    c.setSearchQuery(`artist:"${track.artist}"`);
                  }}
                >
                  Artist
                </ContextMenuItem>
              )}
            </>,
          );
        }}
      />
      <div className="track-info">
        <a
          className="track-title"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (index !== undefined) c.queue.setIndex(index);
            c.as.setCurrentTrack(track);
          }}
        >
          {track.name}
        </a>
        <p>
          {track.album !== "" && (
            <a
              className="track-album"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                c.setSearchQuery(`album:"${track.album}"`);
              }}
            >
              {track.album}
            </a>
          )}
          {track.artist !== "" && (
            <a
              className="track-artist"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                c.setSearchQuery(`artist:"${track.artist}"`);
              }}
            >
              {track.artist}
            </a>
          )}
        </p>
      </div>
      {canEnqueue && (
        <button
          className="icon-btn track-queue-btn"
          onClick={() => c.queue.add(track)}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
      {canUnqueue && index !== undefined && (
        <button
          className="icon-btn track-queue-btn"
          onClick={() => c.queue.remove(index)}
        >
          <FontAwesomeIcon icon={faMinus} />
        </button>
      )}
    </div>
  );
}
