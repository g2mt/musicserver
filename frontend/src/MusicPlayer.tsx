import { createContext, useEffect, useMemo, type Dispatch, type SetStateAction, useContext, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import { Track } from './Track';
import type { TrackData } from './Track';
import { HOST } from './apiserver';
import './MusicPlayer.css';
import './common.css';

interface MusicPlayerState {
  currentTrack: TrackData | null;
  setCurrentTrack: Dispatch<SetStateAction<TrackData | null>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  progress: number;
  setProgress: Dispatch<SetStateAction<number>>;
  duration: number;
  setDuration: Dispatch<SetStateAction<number>>;
  volume: number;
  setVolume: Dispatch<SetStateAction<number>>;
  muted: boolean;
  setMuted: Dispatch<SetStateAction<boolean>>;
  enqueuedTracks: TrackData[];
  unqueueTrack: (index: number) => void;
  // NEW
  enqueuedTrackIndex: number;
  setEnqueuedTrackIndex: Dispatch<SetStateAction<number>>;
}

export const MusicPlayerContext = createContext<MusicPlayerState|null>(null);

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
  const c = useContext(MusicPlayerContext)!;
  const audio = useAudio(c.currentTrack ? `${HOST}/track/${c.currentTrack.short_id}/data` : null);
  const lastProgressUpdateFromAudioRef = useRef<number>(0);

  useEffect(() => {
    c.setProgress(0);
    c.setIsPlaying(true);
  }, [c.currentTrack?.id]);

  useEffect(() => {
    if (c.isPlaying) audio.play();
    else audio.pause();
  }, [c.isPlaying]);

  useEffect(() => {
    audio.volume = c.muted ? 0 : c.volume;
  }, [c.volume, c.muted]);

  // Seek audio when progress changes (e.g., from keyboard shortcuts)
  useEffect(() => {
    // Only seek if the change didn't come from the audio's own timeupdate
    if (Math.abs(audio.currentTime - c.progress) > 0.1) {
      audio.currentTime = c.progress;
    }
  }, [c.progress]);

  useEffect(() => {
    function onEnded() {
      // Instead of always taking the first track, increment the index
      const nextIndex = c.enqueuedTrackIndex + 1;
      if (nextIndex < c.enqueuedTracks.length) {
        c.setEnqueuedTrackIndex(nextIndex);
        c.setCurrentTrack(c.enqueuedTracks[nextIndex]);
      } else {
        // No more tracks in queue
        c.setEnqueuedTrackIndex(-1);
        c.setIsPlaying(false);
      }
    }
    function onTimeUpdate() {
      lastProgressUpdateFromAudioRef.current = audio.currentTime;
      c.setProgress(audio.currentTime);
      c.setDuration(audio.duration || 0);
    }
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio, c.enqueuedTracks, c.enqueuedTrackIndex]);

  function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    audio.currentTime = val;
    c.setProgress(val);
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
