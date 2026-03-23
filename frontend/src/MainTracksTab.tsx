import TrackList from './TrackList';
import type { TrackData } from './Track';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './MainTracksTab.css';
import { useRef } from 'react';

export function MainTracksTab({
  tracks,
  enqueueTrack,
  setSearchQuery
}: {
  tracks: TrackData[],
  enqueueTrack?: (_: TrackData) => void,
  setSearchQuery: (_: string) => void
}) {
  const firstTrack = tracks[0];
  const lastTrack = tracks[tracks.length - 1];
  const elRef = useRef<HTMLElement|null>(null);
  const setSearchQueryAndScroll = (text: string) => {
    setSearchQuery(text);
    elRef.current?.scrollIntoView({ block: "start" });
  };

  const controls = (
    <div className="main-tracks-controls">
      <button
        className="btn"
        onClick={() => firstTrack && setSearchQueryAndScroll(`before:${firstTrack.id}`)}
        disabled={!firstTrack}
        title="Previous"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
        Back
      </button>
      <button
        className="btn"
        onClick={() => lastTrack && setSearchQueryAndScroll(`after:${lastTrack.id}`)}
        disabled={!lastTrack}
        title="Next"
      >
        <FontAwesomeIcon icon={faChevronRight} />
        Forward
      </button>
    </div>
  );

  return (
    <div className="main-tracks-tab" ref={elRef}>
      {controls}
      <TrackList tracks={tracks} enqueueTrack={enqueueTrack} />
      {controls}
    </div>
  );
}
