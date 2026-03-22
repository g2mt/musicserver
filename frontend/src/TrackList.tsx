import { Track, type TrackData } from './Track';
import './TrackList.css';

function TrackList({ 
  tracks, 
  enqueueTrack,
  unqueueTrack 
}: { 
  tracks: TrackData[], 
  enqueueTrack?: (_: TrackData) => void,
  unqueueTrack?: (_: number) => void 
}) {
  return (
    <div className="track-list">
      {tracks.map((track, index) => (
        <Track 
          key={typeof unqueueTrack !== "undefined" ? `${index}-${track.id}` : track.id} /* queued items have order */
          track={track}
          index={typeof unqueueTrack !== "undefined" ? index : undefined}
          enqueueTrack={enqueueTrack}
          unqueueTrack={unqueueTrack}
        />
      ))}
    </div>
  );
}

export default TrackList;
