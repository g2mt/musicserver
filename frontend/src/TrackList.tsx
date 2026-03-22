import { useEffect, useState } from 'react';
import { HOST } from './apiserver';
import './TrackList.css';

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
