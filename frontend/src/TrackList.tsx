import { useContext } from "react";
import { Track } from "./Track";
import { type TrackData } from "./TrackData";
import { AppContext } from "./AppState";
import { faMinus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "./TrackList.css";

function TrackList({
  tracks,
  canEnqueue,
  canUnqueue,
}: {
  tracks: TrackData[];
  canEnqueue?: boolean;
  canUnqueue?: boolean;
}) {
  const c = useContext(AppContext)!;
  return (
    <div className="track-list">
      {canUnqueue && (
        <button className="btn" onClick={() => c.unqueueTrack()}>
          <FontAwesomeIcon icon={faMinus} />
          Remove all from queue
        </button>
      )}
      {tracks.map((track, index) => (
        <Track
          key={
            canUnqueue
              ? `${index}-${track.id}`
              : track.id
          } /* queued items have order */
          track={track}
          index={canUnqueue ? index : undefined}
          canEnqueue={canEnqueue}
          canUnqueue={canUnqueue}
        />
      ))}
    </div>
  );
}

export default TrackList;
