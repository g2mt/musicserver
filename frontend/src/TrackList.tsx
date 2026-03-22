import { Track, type TrackData } from './Track';
import './TrackList.css';

function TrackList({ tracks, enqueueTrack }: { tracks: TrackData[], enqueueTrack?: (_: TrackData) => void }) {
  return (
    <div className="track-list">
      {tracks.map(track => (
        <Track track={track} enqueueTrack={enqueueTrack} />
      ))}
    </div>
  );
}

export default TrackList;
