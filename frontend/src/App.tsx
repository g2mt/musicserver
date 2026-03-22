import TrackList from './TrackList';
import { MusicPlayerContext, MusicPlayer } from './MusicPlayer';
import { useEffect, useState } from 'react';
import type { TrackData } from './Track';
import { HOST } from './apiserver';

function App() {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);

  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);
  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setFullTracks(Object.values(data)));
  }, []);

  const [enqueuedTracks, setEnqueuedTracks] = useState<TrackData[]>([]);

  return (
    <MusicPlayerContext value={{ currentTrack, setCurrentTrack }}>
      <MusicPlayer />
      <TrackList tracks={fullTracks} />
      <TrackList tracks={enqueuedTracks} />
    </MusicPlayerContext>
  );
}

export default App;
