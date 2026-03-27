import { Track } from "./Track";
import { type TrackData } from "./TrackData";

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
  return (
    <div className="track-list">
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
