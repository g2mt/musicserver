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

  // Tracks
  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);
  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setFullTracks(Object.values(data)));
  }, []);

  // Track queue
  const [enqueuedTracks, setEnqueuedTracks] = useState<TrackData[]>([]);
  function enqueueTrack(track: TrackData) {
    setEnqueuedTracks([...enqueuedTracks, track]);
  }
  function unqueueTrack(index: number) {
    setEnqueuedTracks(prev => prev.filter((_, i) => i !== index));
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'm':
          e.preventDefault();
          setMuted(prev => !prev);
          break;
        case 'j':
          e.preventDefault();
          setProgress(prev => Math.max(0, prev - 10));
          break;
        case 'l':
          e.preventDefault();
          setProgress(prev => Math.min(duration, prev + 10));
          break;
        case '(':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.05));
          setMuted(false);
          break;
        case ')':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.05));
          setMuted(false);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [duration]);

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
      setMuted,
      enqueuedTracks,
      unqueueTrack,
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
