import { useContext } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMinus } from "@fortawesome/free-solid-svg-icons";
import { HOST } from "./apiserver";
import { AppContext } from "./AppState";
import type { TrackData } from "./TrackData";

import "./Track.css";

export function getTrackCover(track: TrackData): string {
  return track.thumbnail_path ?? `${HOST}/track/${track.short_id}/cover`;
}

export function Track({
  track,
  highlighted,
  index,
  enqueueTrack,
  unqueueTrack,
}: {
  track: TrackData;
  highlighted?: boolean;
  index?: number;
  enqueueTrack?: (_: TrackData|TrackData[]) => void;
  unqueueTrack?: (_: number) => void;
}) {
  const c = useContext(AppContext)!;
  const { setCurrentTrack, enqueuedTrackIndex, setEnqueuedTrackIndex } =
    useContext(AppContext)!;
  const isHighlighted =
    highlighted || (index !== undefined && index === enqueuedTrackIndex);
  return (
    <div className={`track ${isHighlighted ? "highlighted" : ""}`}>
      <img className="track-cover" src={getTrackCover(track)} />
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
      {enqueueTrack && (
        <button
          className="icon-btn track-queue-btn"
          onClick={() => enqueueTrack(track)}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
      {unqueueTrack && index !== undefined && (
        <button
          className="icon-btn track-queue-btn"
          onClick={() => unqueueTrack(index)}
        >
          <FontAwesomeIcon icon={faMinus} />
        </button>
      )}
    </div>
  );
}
