import TrackList from './TrackList';
import { MainTracksTab } from './MainTracksTab';
import SettingsTab from './SettingsTab';
import { MusicPlayer } from './MusicPlayer';
import SearchBar from './SearchBar';
import React, { useEffect, useRef, useState } from 'react';
import type { TrackData } from './Track';
import { HOST } from './apiserver';
import { faMusic, faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppContext, type AppState } from './AppState';
import { flushSync } from 'react-dom';

import './App.css';
import { createRoot } from 'react-dom/client';

function App() {
  const a = {} as AppState;

  // State variables
  [a.currentTrack, a.setCurrentTrack] = useState<TrackData | null>(null);
  [a.isPlaying, a.setIsPlaying] = useState(false);
  [a.progress, a.setProgress] = useState(0);
  [a.duration, a.setDuration] = useState(0);
  [a.volume, a.setVolume] = useState(1);
  [a.muted, a.setMuted] = useState(false);
  [a.enqueuedTrackIndex, a.setEnqueuedTrackIndex] = useState<number|null>(null);

  // Tracks
  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);

  const setFullTracksFromData = (data: any) => {
    if (data === null || data.length === 0) {
      toast.warn('No tracks found');
    } else {
      setFullTracks(data);
    }
  };

  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setFullTracksFromData(data));
  }, []);

  // Search
  [a.searchQuery, a.setSearchQuery] = useState('');
  useEffect(() => {
    fetch(`${HOST}/track?q=${encodeURIComponent(a.searchQuery)}`)
      .then(res => res.json())
      .then(data => setFullTracksFromData(data));
  }, [a.searchQuery]);

  // Confirm boxes
  const confirmBoxes = useRef<HTMLElement|null>(null);
  a.addConfirmBox = (confirmBox: React.ReactNode) => {
    const div = document.createElement('div');
    const root = createRoot(div);
    flushSync(() => root.render(confirmBox));
    confirmBoxes.current?.prepend(div);
  };

  // Track queue
  [a.enqueuedTracks, a.setEnqueuedTracks] = useState<TrackData[]>([]);
  a.enqueueTrack = (track: TrackData) => {
    a.setEnqueuedTracks([...a.enqueuedTracks, track]);
  };
  a.unqueueTrack = (index: number) => {
    a.setEnqueuedTracks(prev => prev.filter((_, i) => i !== index));
    // If we remove a track before the current index, adjust the index
    if (a.enqueuedTrackIndex !== null && index < a.enqueuedTrackIndex) {
      a.setEnqueuedTrackIndex(prev => (prev ?? 1) - 1);
    } else if (index === a.enqueuedTrackIndex) {
      // If we remove the currently highlighted track, reset index
      a.setEnqueuedTrackIndex(null);
    }
  };

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
          a.setIsPlaying(prev => !prev);
          break;
        case 'm':
          e.preventDefault();
          a.setMuted(prev => !prev);
          break;
        case 'j':
          e.preventDefault();
          a.setProgress(prev => Math.max(0, prev - 10));
          break;
        case 'l':
          e.preventDefault();
          a.setProgress(prev => Math.min(a.duration, prev + 10));
          break;
        case '(':
          e.preventDefault();
          a.setVolume(prev => Math.max(0, prev - 0.05));
          a.setMuted(false);
          break;
        case ')':
          e.preventDefault();
          a.setVolume(prev => Math.min(1, prev + 0.05));
          a.setMuted(false);
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [a.duration]);

  return (
    <AppContext value={a}>
      <ToastContainer position="bottom-right" theme="dark" />
      <div className="app-layout">
        <div className="search-bar-container">
          <SearchBar searchQuery={a.searchQuery} setSearchQuery={a.setSearchQuery} />
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
            <div className="confirm-box-container" ref={confirmBoxes}></div>
            {leftTab === 'tracks' && <MainTracksTab tracks={fullTracks} />}
            {leftTab === 'settings' && <SettingsTab />}
          </div>
          <div className="right-side"
              style={{display: a.enqueuedTracks.length > 0 ? 'block' : 'none' }}>
            <TrackList tracks={a.enqueuedTracks} unqueueTrack={a.unqueueTrack} />
          </div>
        </div>
        <div className="music-player">
          <MusicPlayer />
        </div>
      </div>
    </AppContext>
  );
}

export default App;
