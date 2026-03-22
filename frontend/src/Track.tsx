import { useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { HOST } from './apiserver';
import { MusicPlayerContext } from './MusicPlayer';
import './Track.css';

export interface TrackData {
  id: string;
  short_id: string;
  name: string;
  album: string;
  path: string;
}

export function Track({ track, showEnqueueButton = false }: { track: TrackData, showEnqueueButton?: boolean }) {
  const { setCurrentTrack } = useContext(MusicPlayerContext);
  return (
    <div className="track">
      <img
        className="track-cover"
        src={`${HOST}/track/${track.short_id}/cover`}
        alt={track.name}
      />
      <div className="track-info">
        <a className="track-title" href="#" onClick={e => { e.preventDefault(); if (setCurrentTrack) setCurrentTrack(track); }}>{track.name}</a>
        <span className="track-album">{track.album}</span>
      </div>
      {showEnqueueButton && (
        <button className="track-enqueue" onClick={() => alert(`Enqueue: ${track.name}`)}>
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
    </div>
  );
}

