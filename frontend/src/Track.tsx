import { useContext, type Dispatch, type SetStateAction } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { HOST } from './apiserver';
import { MusicPlayerContext } from './MusicPlayer';
import './Track.css';
import './common.css';

export interface TrackData {
  id: string;
  short_id: string;
  name: string;
  album: string;
  path: string;
}

export function Track({ track, enqueueTrack }: { track: TrackData, enqueueTrack?: (_: TrackData) => void }) {
  const { setCurrentTrack } = useContext(MusicPlayerContext);
  return (
    <div className="track">
      <img
        className="cover"
        src={`${HOST}/track/${track.short_id}/cover`}
        alt={track.name}
      />
      <div className="info">
        <a className="title" href="#" onClick={e => { e.preventDefault(); if (setCurrentTrack) setCurrentTrack(track); }}>{track.name}</a>
        <span className="album">{track.album}</span>
      </div>
      {enqueueTrack && (
        <button className="btn enqueue-btn" onClick={() => enqueueTrack(track)}>
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
    </div>
  );
}

