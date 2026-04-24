import { useContext, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faMinus,
  faPlay,
  faCopy,
  faCompactDisc,
  faUser,
  faFolder,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { getTrackCoverFromId, getTrackCoverFromPath, fetchAPI } from "src/apiServer";
import { AppContext } from "src/AppState";
import { toggleContextMenu, ContextMenuItem } from "src/ContextMenu";
import { toast } from "react-toastify";
import type { TrackData } from "src/TrackData";

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
  act,
}: {
  track: TrackData;
  highlighted?: boolean;
  index?: number;
  act?: "enqueue" | "unqueue";
}) {
  const c = useContext(AppContext)!;
  const isHighlighted =
    highlighted || (index !== undefined && index === c.queue.index);

  const [forgotten, setForgotten] = useState(false);
  if (forgotten) {
    return null;
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLImageElement>) => {
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
              c.setSearchQuery((old) => ({
                ...old,
                q: `album:"${track.album}"`,
              }));
            }}
          >
            Album
          </ContextMenuItem>
        )}
        {track.artist !== "" && (
          <ContextMenuItem
            icon={faUser}
            onClick={() => {
              c.setSearchQuery((old) => ({
                ...old,
                q: `artist:"${track.artist}"`,
              }));
            }}
          >
            Artist
          </ContextMenuItem>
        )}
        <ContextMenuItem
          icon={faFolder}
          onClick={() => {
            const parts = track.path.split("/");
            parts.pop();
            c.setFbPath(parts);
            c.setLeftTab("files");
          }}
        >
          Path
        </ContextMenuItem>
        <ContextMenuItem
          icon={faTrash}
          onClick={() => {
            fetchAPI(`/track/${track.id}`, undefined, "DELETE")
            .then(() => {
              toast.success(`Track "${track.name}" forgotten`);
              setForgotten(true);
            }).catch(err => {
              toast.error(`Failed to forget track: ${err}`);
            });
          }}
        >
          Forget track
        </ContextMenuItem>
      </>,
    );
  };

  return (
    <div className={`track ${isHighlighted ? "highlighted" : ""}`}>
      <img
        className="track-cover"
        src={getTrackCover(track)}
        onClick={handleContextMenu}
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
                c.setSearchQuery((old) => ({
                  ...old,
                  q: `album:"${track.album}"`,
                }));
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
                c.setSearchQuery((old) => ({
                  ...old,
                  q: `artist:"${track.artist}"`,
                }));
              }}
            >
              {track.artist}
            </a>
          )}
        </p>
      </div>
      {act === "enqueue" && (
        <button
          className="icon-btn track-queue-btn"
          onClick={() => c.queue.add(track)}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
      {act === "unqueue" && index !== undefined && (
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
