import { useEffect, useState } from 'react';
import { HOST } from './apiserver';
import Track from './Track';
import './TrackList.css';

interface TrackData {
  id: string;
  short_id: string;
  name: string;
  album: string;
  path: string;
}

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
