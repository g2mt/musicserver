import TrackList from './TrackList';
import { MusicPlayerContext, MusicPlayer } from './MusicPlayer';
import { useEffect, useState } from 'react';
import type { TrackData } from './Track';
import { HOST } from './apiserver';

function App() {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);

  const [tracks, setTracks] = useState<Record<string, TrackData>>({});
  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setTracks(data));
  }, []);

  return (
    <MusicPlayerContext value={{ currentTrack, setCurrentTrack }}>
      <MusicPlayer />
      <TrackList tracks={tracks} />
    </MusicPlayerContext>
  );
}

export default App;
