import TrackList from './TrackList';
import { MainTracksTab } from './MainTracksTab';
import SettingsTab from './SettingsTab';
import { MusicPlayerContext, MusicPlayer } from './MusicPlayer';
import SearchBar from './SearchBar';
import { useEffect, useState } from 'react';
import type { TrackData } from './Track';
import { HOST } from './apiserver';
import { faMusic, faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [enqueuedTrackIndex, setEnqueuedTrackIndex] = useState<number|null>(null);

  // Tracks
  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);
  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setFullTracks(Object.values(data)));
  }, []);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    fetch(`${HOST}/track?q=${encodeURIComponent(searchQuery)}`)
      .then(res => res.json())
      .then(data => setFullTracks(Object.values(data)));
  }, [searchQuery]);

  // Track queue
  const [enqueuedTracks, setEnqueuedTracks] = useState<TrackData[]>([]);
  function enqueueTrack(track: TrackData) {
    setEnqueuedTracks([...enqueuedTracks, track]);
  }
  function unqueueTrack(index: number) {
    setEnqueuedTracks(prev => prev.filter((_, i) => i !== index));
    // If we remove a track before the current index, adjust the index
    if (enqueuedTrackIndex !== null && index < enqueuedTrackIndex) {
      setEnqueuedTrackIndex(prev => (prev ?? 1) - 1);
    } else if (index === enqueuedTrackIndex) {
      // If we remove the currently highlighted track, reset index
      setEnqueuedTrackIndex(null);
    }
  }

  // Left-side tab
  const [leftTab, setLeftTab] = useState<'tracks' | 'settings'>('tracks');

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
      enqueuedTrackIndex,
      setEnqueuedTrackIndex,
    }}>
      <ToastContainer position="bottom-right" theme="dark" />
      <div className="app-layout">
        <div className="search-bar-container">
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        </div>
        <div className="app-main">
          <div className="left-side">
            <div className="tab-bar">
              <button
                className={`tab-btn ${leftTab === 'tracks' ? 'active' : ''}`}
                onClick={() => setLeftTab('tracks')}
                title="Tracks"
              >
                <FontAwesomeIcon icon={faMusic} />
              </button>
              <button
                className={`tab-btn ${leftTab === 'settings' ? 'active' : ''}`}
                onClick={() => setLeftTab('settings')}
                title="Settings"
              >
                <FontAwesomeIcon icon={faGear} />
              </button>
            </div>
            {leftTab === 'tracks' && <MainTracksTab tracks={fullTracks} enqueueTrack={enqueueTrack} setSearchQuery={setSearchQuery} />}
            {leftTab === 'settings' && <SettingsTab />}
          </div>
          <div className="right-side">
            <TrackList tracks={enqueuedTracks} unqueueTrack={unqueueTrack} />
          </div>
        </div>
        <div className="music-player">
          <MusicPlayer />
        </div>
      </div>
    </MusicPlayerContext>
  );
}

export default App;
