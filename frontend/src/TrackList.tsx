import { Track, type TrackData } from './Track';
import './TrackList.css';

function TrackList({ tracks, showEnqueueButton = false }: { tracks: TrackData[], showEnqueueButton?: boolean }) {
  return (
    <div className="track-list">
      {tracks.map(track => (
        <Track track={track} showEnqueueButton={showEnqueueButton} />
      ))}
    </div>
  );
}

export default TrackList;
