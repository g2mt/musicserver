import TrackList from './TrackList';
import { MainTracksTab } from './MainTracksTab';
import SettingsTab from './SettingsTab';
import { MusicPlayer } from './MusicPlayer';
import SearchBar from './SearchBar';
import React, { useEffect, useRef, useState } from 'react';
import { getTrackCover, type TrackData } from './Track';
import { HOST } from './apiserver';
import { faMusic, faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppContext, type AppState } from './AppState';
import './App.css';

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
  [a.darkMode, a.setDarkMode] = useState(false);

  // Media Session API
  useEffect(() => {
    if ('mediaSession' in navigator && a.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: a.currentTrack.name,
        artist: a.currentTrack.artist,
        album: a.currentTrack.album,
        artwork: [
          { src: getTrackCover(a.currentTrack), sizes: '96x96', type: 'image/png' },
          { src: getTrackCover(a.currentTrack), sizes: '128x128', type: 'image/png' },
          { src: getTrackCover(a.currentTrack), sizes: '192x192', type: 'image/png' },
          { src: getTrackCover(a.currentTrack), sizes: '256x256', type: 'image/png' },
          { src: getTrackCover(a.currentTrack), sizes: '384x384', type: 'image/png' },
          { src: getTrackCover(a.currentTrack), sizes: '512x512', type: 'image/png' },
        ]
      });

      // Set up action handlers
      const handlePlay = () => a.setIsPlaying(true);
      const handlePause = () => a.setIsPlaying(false);
      const handlePrevTrack = () => {
        // If there's a previous track in the queue, play it
        if (a.enqueuedTrackIndex !== null && a.enqueuedTrackIndex > 0) {
          const prevIndex = a.enqueuedTrackIndex - 1;
          a.setEnqueuedTrackIndex(prevIndex);
          a.setCurrentTrack(a.enqueuedTracks[prevIndex]);
        }
      };
      const handleNextTrack = () => {
        // If there's a next track in the queue, play it
        if (a.enqueuedTrackIndex !== null && a.enqueuedTrackIndex < a.enqueuedTracks.length - 1) {
          const nextIndex = a.enqueuedTrackIndex + 1;
          a.setEnqueuedTrackIndex(nextIndex);
          a.setCurrentTrack(a.enqueuedTracks[nextIndex]);
        }
      };

      navigator.mediaSession.setActionHandler('play', handlePlay);
      navigator.mediaSession.setActionHandler('pause', handlePause);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
      navigator.mediaSession.setActionHandler('stop', null);
    }
  }, [a.currentTrack, a.enqueuedTrackIndex, a.enqueuedTracks, a.setIsPlaying, a.setCurrentTrack, a.setEnqueuedTrackIndex]);

  // Update body background when current track changes
  const overlay = document.getElementById("background-overlay")!;
  useEffect(() => {
    if (a.darkMode) {
      overlay.innerHTML = `
      <style>:root { fill: #000; stroke: none; }</style>
      <filter id="blur">
        <feGaussianBlur stdDeviation="30" edgeMode="wrap" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.1"/>
          <feFuncG type="linear" slope="0.1"/>
          <feFuncB type="linear" slope="0.1"/>
          <feFuncA type="linear" slope="1"/>
        </feComponentTransfer>
      </filter>
      <image width="100%" href="" filter="url(#blur)"/>`;
    } else {
      overlay.innerHTML = "";
    }
  }, [a.darkMode]);
  useEffect(() => {
    const image = overlay.querySelector('image');
    if (!image)
      return;
    if (a.currentTrack && a.darkMode) {
      const cover = getTrackCover(a.currentTrack);
      if (cover !== image.getAttribute('href')) {
        image.setAttribute('href', cover);
      }
    } else if (image.getAttribute('href')) {
      image.setAttribute('href', '');
    }
  }, [a.currentTrack, a.darkMode]);


  useEffect(() => {
    fetch(`${HOST}/track`)
      .then(res => res.json())
      .then(data => setFullTracksFromData(data));
  }, []);

  // Hash params (parsed like URLSearchParams but from window.location.hash)
  const getHashParams = () => new URLSearchParams(window.location.hash.slice(1));
  const setHashParam = (key: string, value: string) => {
    const params = getHashParams();
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    window.location.hash = params.toString();
  };

  // Search
  [a.searchQuery, a.setSearchQuery] = useState(() => getHashParams().get('q') ?? '');
  useEffect(() => {
    setHashParam('q', a.searchQuery);
    fetch(`${HOST}/track?q=${encodeURIComponent(a.searchQuery)}`)
      .then(res => res.json())
      .then(data => setFullTracksFromData(data));
  }, [a.searchQuery]);

  // Confirm boxes
  const [confirmBoxes, setConfirmBoxes] = useState<{
    key: number;
    el: React.ReactNode
  }[]>([]);
  let confirmBoxesCounter = useRef(0);
  a.addConfirmBox = (confirmBox: React.ReactNode) => {
    setConfirmBoxes([
      { key: confirmBoxesCounter.current, el: confirmBox },
      ...confirmBoxes
    ]);
    confirmBoxesCounter.current += 1;
  };

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

  // Tracks
  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);

  const setFullTracksFromData = (data: any) => {
    if (data === null || data.length === 0) {
      toast.warn('No tracks found');
    } else {
      setFullTracks(data);
    }
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
            {confirmBoxes.map(b => (<div key={b.key}>{b.el}</div>))}
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
