import { HOST } from './apiserver';
import { useMusicPlayer } from './MusicPlayer';
import './Track.css';

export interface TrackData {
  id: string;
  short_id: string;
  name: string;
  album: string;
  path: string;
}

export function Track({ shortId, track }: { shortId: string; track: TrackData }) {
  const { play } = useMusicPlayer();
  return (
    <div className="track">
      <img
        className="track-cover"
        src={`${HOST}/track/${shortId}/cover`}
        alt={track.name}
      />
      <div className="track-info">
        <a className="track-title" href="#" onClick={e => { e.preventDefault(); play(track); }}>{track.name}</a>
        <span className="track-album">{track.album}</span>
      </div>
    </div>
  );
}

