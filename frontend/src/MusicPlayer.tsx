import { createContext, useContext, useRef, useState, useEffect, useMemo } from 'react';
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
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const audioUrl = currentTrack ? `${HOST}/track/${currentTrack.short_id}/data` : null;
  const audio = useAudio(audioUrl);

  function play(track: TrackData) {
    setCurrentTrack(track);
    setProgress(0);
    setIsPlaying(true);
  }

  useEffect(() => {
    if (isPlaying) audio.play();
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    function onEnded() { setIsPlaying(false); }
    function onTimeUpdate() {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
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
    setProgress(val);
  }

  return (
    <MusicPlayerContext.Provider value={{ currentTrack, play }}>
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
