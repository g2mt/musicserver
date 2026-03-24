import { useContext, type Dispatch, type SetStateAction } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';
import { HOST } from './apiserver';
import { MusicPlayerContext } from './MusicPlayer';
import './Track.css';

export interface TrackData {
  id: string;
  short_id: string;
  name: string;
  artist: string;
  album: string;
  path: string;
}

export function Track({ 
  track, 
  index,
  enqueueTrack,
  unqueueTrack
}: { 
  track: TrackData, 
  index?: number,
  enqueueTrack?: (_: TrackData) => void,
  unqueueTrack?: (_: number) => void 
}) {
  const c = useContext(MusicPlayerContext)!;
  const { setCurrentTrack, enqueuedTrackIndex, setEnqueuedTrackIndex } = useContext(MusicPlayerContext)!;
  const isHighlighted = index !== undefined && index === enqueuedTrackIndex;
  return (
    <div className={`track ${isHighlighted ? 'highlighted' : ''}`}>
      <img
        className="track-cover"
        src={`${HOST}/track/${track.short_id}/cover`}
      />
      <div className="track-info">
        <a className="track-title" href="#" onClick={e => {
          e.preventDefault();
          if (index !== undefined)
            setEnqueuedTrackIndex(index);
          setCurrentTrack(track);
        }}>{track.name}</a>
        <a className="track-album" href="#" onClick={e => {
          e.preventDefault();
          c.setSearchQuery(`album:"${track.album}"`);
        }}>{track.album}</a>
        <a className="track-artist" href="#" onClick={e => {
          e.preventDefault();
          c.setSearchQuery(`artist:"${track.artist}"`);
        }}>{track.artist}</a>
      </div>
      {enqueueTrack && (
        <button className="icon-btn track-queue-btn" onClick={() => enqueueTrack(track)}>
          <FontAwesomeIcon icon={faPlus} />
        </button>
      )}
      {unqueueTrack && index !== undefined && (
        <button className="icon-btn track-queue-btn" onClick={() => unqueueTrack(index)}>
          <FontAwesomeIcon icon={faMinus} />
        </button>
      )}
    </div>
  );
}

