import { Track, type TrackData } from './Track';
import './TrackList.css';

function TrackList({ tracks }: { tracks: Record<string, TrackData> }) {
  return (
    <div className="track-list">
      {Object.entries(tracks).map(([shortId, track]) => (
        <Track key={shortId} track={track} />
      ))}
    </div>
  );
}

export default TrackList;
