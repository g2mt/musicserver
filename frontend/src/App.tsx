import TrackList from './TrackList';
import { MusicPlayerContext, MusicPlayer } from './MusicPlayer';
import { useEffect, useState } from 'react';
import type { TrackData } from './Track';
import { HOST } from './apiserver';
import './App.css';

function App() {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

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
    <MusicPlayerContext value={{
      currentTrack, 
      setCurrentTrack,
      isPlaying,
      setIsPlaying,
      progress,
      setProgress,
      duration,
      setDuration,
      volume,
      setVolume,
      muted,
      setMuted
    }}>
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
