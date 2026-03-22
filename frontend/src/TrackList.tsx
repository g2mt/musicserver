import { useEffect, useState } from 'react';
import { HOST } from './apiserver';
import { Track, type TrackData } from './Track';
import './TrackList.css';

function TrackList() {
  const [tracks, setTracks] = useState<Record<string, TrackData>>({});

  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setTracks(data));
  }, []);

  return (
    <div className="track-list">
      {Object.entries(tracks).map(([shortId, track]) => (
        <Track key={shortId} shortId={shortId} track={track} />
      ))}
    </div>
  );
}

export default TrackList;
