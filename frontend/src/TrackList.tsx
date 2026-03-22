import { Track, type TrackData } from './Track';
import './TrackList.css';

function TrackList({ tracks }: { tracks: TrackData[] }) {
  return (
    <div className="track-list">
      {tracks.map(track => (
        <Track track={track} />
      ))}
    </div>
  );
}

export default TrackList;
