import TrackList from './TrackList';
import { MusicPlayerContext, MusicPlayer } from './MusicPlayer';
import { useEffect, useState } from 'react';
import type { TrackData } from './Track';
import { HOST } from './apiserver';
import './App.css';

function App() {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);

  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);
  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setFullTracks(Object.values(data)));
  }, []);

  const [enqueuedTracks, setEnqueuedTracks] = useState<TrackData[]>([]);
  function enqueueTrack(track: TrackData) {
    setEnqueuedTracks([...enqueuedTracks, track]);
  }
  function unqueueTrack(index: number) {
    setEnqueuedTracks(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <MusicPlayerContext value={{ currentTrack, setCurrentTrack }}>
      <div className="app-layout">
        <div className="full-tracks">
          <TrackList tracks={fullTracks} enqueueTrack={enqueueTrack} />
        </div>
        <div className="enqueued-tracks">
          <TrackList tracks={enqueuedTracks} unqueueTrack={unqueueTrack} />
        </div>
        <div className="music-player">
          <MusicPlayer />
        </div>
      </div>
    </MusicPlayerContext>
  );
}

export default App;
