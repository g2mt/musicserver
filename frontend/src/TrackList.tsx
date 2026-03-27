import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { Track } from "./Track";
import { type TrackData } from "./TrackData";
import { AppContext } from "./AppState";
import { faMinus, faShuffle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "./TrackList.css";

const PAGE_SIZE = 50;
const TRACK_HEIGHT_PX = 72; // approximate height of a single track row in pixels

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
        <div className="track-list-buttons">
          <button className="btn" onClick={() => c.unqueueTrack()}>
            <FontAwesomeIcon icon={faMinus} />
            Remove all from queue
          </button>
          <button className="btn" onClick={() => {
            const shuffled = [...c.enqueuedTracks];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            c.setEnqueuedTracks(shuffled);
          }}>
            <FontAwesomeIcon icon={faShuffle} />
            Shuffle queue
          </button>
        </div>
      )}

      {tracks.map((track, i) => {
        const index = i;
        return (
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
        );
      })}
    </div>
  );
}

export default TrackList;
