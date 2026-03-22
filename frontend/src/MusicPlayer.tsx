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
  const c = useContext(MusicPlayerContext);

  const audioUrl = c.currentTrack ? `${HOST}/track/${c.currentTrack.short_id}/data` : null;
  const audio = useAudio(audioUrl);

  useEffect(() => {
    if (c.setProgress) c.setProgress(0);
    if (c.setIsPlaying) c.setIsPlaying(true);
  }, [c.currentTrack?.id]);

  useEffect(() => {
    if (c.isPlaying) audio.play();
    else audio.pause();
  }, [c.isPlaying]);

  useEffect(() => {
    audio.volume = c.muted ? 0 : c.volume;
  }, [c.volume, c.muted]);

  useEffect(() => {
    function onEnded() { if (c.setIsPlaying) c.setIsPlaying(false); }
    function onTimeUpdate() {
      if (c.setProgress) c.setProgress(audio.currentTime);
      if (c.setDuration) c.setDuration(audio.duration || 0);
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
    if (c.setProgress) c.setProgress(val);
  }

  return (
    <div className="music-player">
      <input
        className="scrubber-bar"
        type="range"
        min={0}
        max={c.duration || 0}
        step={0.1}
        value={c.progress}
        onChange={onScrub}
      />
      <div className="player-controls">
        <div className="player-left">
          <button className="btn" onClick={() => c.setIsPlaying && c.setIsPlaying(p => !p)}>
            <FontAwesomeIcon icon={c.isPlaying ? faPause : faPlay} />
          </button>
        </div>
        <div className="player-center">
          {c.currentTrack && <Track track={c.currentTrack} />}
        </div>
        <div className="player-right">
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={c.muted ? 0 : c.volume}
            onChange={e => { 
              if (c.setVolume) c.setVolume(Number(e.target.value)); 
              if (c.setMuted) c.setMuted(false); 
            }}
          />
          <button className="btn" onClick={() => c.setMuted && c.setMuted(m => !m)}>
            <FontAwesomeIcon icon={c.muted || c.volume === 0 ? faVolumeXmark : faVolumeHigh} />
          </button>
        </div>
      </div>
    </div>
  );
}
