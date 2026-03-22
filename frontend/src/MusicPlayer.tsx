import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import { Track } from './Track';
import type { TrackData } from './Track';
import { HOST } from './apiserver';
import './MusicPlayer.css';

interface MusicPlayerState {
  currentTrack: TrackData | null;
  play: (track: TrackData) => void;
}

const MusicPlayerContext = createContext<MusicPlayerState>({
  currentTrack: null,
  play: () => {},
});

export function useMusicPlayer() {
  return useContext(MusicPlayerContext);
}

export function MusicPlayer({ children }: { children?: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  function play(track: TrackData) {
    setCurrentTrack(track);
    setProgress(0);
    setIsPlaying(true);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = `${HOST}/track/${currentTrack.short_id}/data`;
    audio.currentTime = 0;
    audio.play();
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play();
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime);
    setDuration(audio.duration || 0);
  }

  function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setProgress(Number(e.target.value));
  }

  return (
    <MusicPlayerContext.Provider value={{ currentTrack, play }}>
      {children}
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={() => setIsPlaying(false)} />
      <div className="music-player">
        <input
          className="scrubber-bar"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={progress}
          onChange={onScrub}
        />
        <div className="player-controls">
          <div className="player-left">
            <button className="play-pause-btn" onClick={() => setIsPlaying(p => !p)}>
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
          </div>
          <div className="player-center">
            {currentTrack && <Track shortId={currentTrack.short_id} track={currentTrack} />}
          </div>
          <div className="player-right">
            <input
              className="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={e => { setVolume(Number(e.target.value)); setMuted(false); }}
            />
            <button className="volume-btn" onClick={() => setMuted(m => !m)}>
              <FontAwesomeIcon icon={muted || volume === 0 ? faVolumeXmark : faVolumeHigh} />
            </button>
          </div>
        </div>
      </div>
    </MusicPlayerContext.Provider>
  );
}
