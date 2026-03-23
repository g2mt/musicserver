import TrackList from './TrackList';
import type { TrackData } from './Track';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './MainTracksTab.css';

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

  return (
    <div className="main-tracks-tab">
      <div className="main-tracks-controls">
        <button
          className="btn"
          onClick={() => firstTrack && setSearchQuery(`before:${firstTrack.id}`)}
          disabled={!firstTrack}
          title="Previous"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
          Back
        </button>
        <button
          className="btn"
          onClick={() => lastTrack && setSearchQuery(`after:${lastTrack.id}`)}
          disabled={!lastTrack}
          title="Next"
        >
          <FontAwesomeIcon icon={faChevronRight} />
          Forward
        </button>
      </div>
      <TrackList tracks={tracks} enqueueTrack={enqueueTrack} />
    </div>
  );
}
