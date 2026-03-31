import { useContext } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faMinus,
  faCopy,
  faCompactDisc,
  faUser,
  faFolder,
} from "@fortawesome/free-solid-svg-icons";
import { getTrackCoverFromId, getTrackCoverFromPath } from "./apiserver";
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
  const { setCurrentTrack, enqueuedTrackIndex, setEnqueuedTrackIndex } =
    useContext(AppContext)!;
  const isHighlighted =
    highlighted || (index !== undefined && index === enqueuedTrackIndex);
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
                icon={faCopy}
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${track.name} - ${track.artist}`,
                  );
                }}
              >
                Copy info
              </ContextMenuItem>
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
              <ContextMenuItem
                icon={faFolder}
                onClick={() => {
                  const dataPath = c.props?.config.data_path;
                  if (dataPath && track.path.startsWith(dataPath)) {
                    const relativePath = track.path.slice(dataPath.length);
                    const parts = relativePath.split("/").filter((p) => p);
                    if (parts.length > 0) {
                      parts.pop();
                      c.setFbPath(parts);
                      c.setLeftTab("files");
                    }
                  }
                }}
              >
                Path
              </ContextMenuItem>
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
            if (index !== undefined) setEnqueuedTrackIndex(index);
            setCurrentTrack(track);
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
          onClick={() => c.enqueueTrack(track)}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
      {canUnqueue && index !== undefined && (
        <button
          className="icon-btn track-queue-btn"
          onClick={() => c.unqueueTrack(index)}
        >
          <FontAwesomeIcon icon={faMinus} />
        </button>
      )}
    </div>
  );
}
