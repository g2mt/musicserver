import { createContext, useState, useEffect, useMemo, type Dispatch, type SetStateAction, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import { Track } from './Track';
import type { TrackData } from './Track';
import { HOST } from './apiserver';
import './MusicPlayer.css';
import './common.css';

interface MusicPlayerState {
  currentTrack: TrackData | null;
  setCurrentTrack: Dispatch<SetStateAction<TrackData | null>> | null;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>> | null;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>> | null;
  duration: number;
  setDuration: Dispatch<SetStateAction<number>> | null;
  volume: number;
  setVolume: Dispatch<SetStateAction<number>> | null;
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>> | null;
}

export const MusicPlayerContext = createContext<MusicPlayerState>({
  currentTrack: null,
  setCurrentTrack: null,
  isPlaying: false,
  setIsPlaying: null,
  progress: 0,
  setProgress: null,
  duration: 0,
  setDuration: null,
  volume: 1,
  setVolume: null,
  muted: false,
  setMuted: null,
});

function useAudio(url: string | null) {
  const audio = useMemo(() => new Audio(), []);

  useEffect(() => {
    if (!url) return;
    audio.src = url;
    audio.currentTime = 0;
    audio.play();
  }, [url]);

  useEffect(() => {
    return () => { audio.pause(); };
  }, [audio]);

  return audio;
}

export function MusicPlayer() {
  const { 
    currentTrack, 
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
  } = useContext(MusicPlayerContext);

  const audioUrl = currentTrack ? `${HOST}/track/${currentTrack.short_id}/data` : null;
  const audio = useAudio(audioUrl);

  useEffect(() => {
    if (setProgress) setProgress(0);
    if (setIsPlaying) setIsPlaying(true);
  }, [currentTrack?.id]);

  useEffect(() => {
    if (isPlaying) audio.play();
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    function onEnded() { if (setIsPlaying) setIsPlaying(false); }
    function onTimeUpdate() {
      if (setProgress) setProgress(audio.currentTime);
      if (setDuration) setDuration(audio.duration || 0);
    }
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio]);

  function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    audio.currentTime = val;
    if (setProgress) setProgress(val);
  }

  return (
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
          <button className="btn" onClick={() => setIsPlaying && setIsPlaying(p => !p)}>
            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
          </button>
        </div>
        <div className="player-center">
          {currentTrack && <Track track={currentTrack} />}
        </div>
        <div className="player-right">
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={e => { 
              if (setVolume) setVolume(Number(e.target.value)); 
              if (setMuted) setMuted(false); 
            }}
          />
          <button className="btn" onClick={() => setMuted && setMuted(m => !m)}>
            <FontAwesomeIcon icon={muted || volume === 0 ? faVolumeXmark : faVolumeHigh} />
          </button>
        </div>
      </div>
    </div>
  );
}
