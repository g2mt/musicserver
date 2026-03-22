import { HOST } from './apiserver';
import './Track.css';

interface TrackData {
  id: string;
  short_id: string;
  name: string;
  album: string;
  path: string;
}

function Track({ shortId, track }: { shortId: string; track: TrackData }) {
  return (
    <div className="track">
      <img
        className="track-cover"
        src={`${HOST}/track/${shortId}/cover`}
        alt={track.name}
      />
      <div className="track-info">
        <span className="track-title">{track.name}</span>
        <span className="track-album">{track.album}</span>
      </div>
    </div>
  );
}

export default Track;
