import { useEffect, useMemo, useContext, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faVolumeHigh, faVolumeXmark, faBackwardStep, faForwardStep } from '@fortawesome/free-solid-svg-icons';
import { Track } from './Track';
import { HOST } from './apiserver';
import { useWindowWidth, PLAYER_COLLAPSE_AT_WIDTH } from './responsive';
import './MusicPlayer.css';
import { AppContext, type AppState } from './AppState';

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

export function useBackForward(c: AppState) {
  const isBackDisabled = useMemo(
    () => c.enqueuedTrackIndex === null || c.enqueuedTrackIndex <= 0,
    [c.enqueuedTrackIndex]);
  const isForwardDisabled = useMemo(
    () => c.enqueuedTrackIndex === null || 
    c.enqueuedTrackIndex + 1 >= c.enqueuedTracks.length,
    [c.enqueuedTrackIndex, c.enqueuedTracks]);

  function handleBack() {
    if (isBackDisabled) return;
    const prevIndex = (c.enqueuedTrackIndex ?? 0) - 1;
    c.setEnqueuedTrackIndex(prevIndex);
    c.setCurrentTrack(c.enqueuedTracks[prevIndex]);
  }

  function handleForward() {
    if (isForwardDisabled) return;
    const nextIndex = (c.enqueuedTrackIndex ?? 0) + 1;
    c.setEnqueuedTrackIndex(nextIndex);
    c.setCurrentTrack(c.enqueuedTracks[nextIndex]);
  }

  return {
    handleBack,
    handleForward,
    isBackDisabled,
    isForwardDisabled
  };
}

export function MusicPlayer() {
  const c = useContext(AppContext)!;
  const audio = useAudio(c.currentTrack ? `${HOST}/track/${c.currentTrack.short_id}/data` : null);
  const lastProgressUpdateFromAudioRef = useRef<number>(0);

  useEffect(() => {
    c.setProgress(0);
    c.setIsPlaying(true);
  }, [c.currentTrack, c.enqueuedTrackIndex]);

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
    if (Math.abs(lastProgressUpdateFromAudioRef.current - c.progress) > 0.1) {
      audio.currentTime = c.progress;
    }
  }, [c.progress]);

  useEffect(() => {
    function onEnded() {
      const nextIndex = (c.enqueuedTrackIndex ?? -1) + 1;
      if (nextIndex < c.enqueuedTracks.length) {
        c.setEnqueuedTrackIndex(nextIndex);
        c.setCurrentTrack(c.enqueuedTracks[nextIndex]);
      } else {
        // No more tracks in queue
        c.setEnqueuedTrackIndex(null);
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

  const { handleBack, handleForward, isBackDisabled, isForwardDisabled } = useBackForward(c);
  const windowWidth = useWindowWidth();
  const collapsed = windowWidth < PLAYER_COLLAPSE_AT_WIDTH;

  return (
    <div className={`music-player${collapsed ? ' collapsed' : ''}`}>
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
          <button 
            className="icon-btn btn-prev-song" 
            onClick={handleBack}
            disabled={isBackDisabled}
          >
            <FontAwesomeIcon icon={faBackwardStep} />
          </button>
          <button className="icon-btn btn-play-pause" onClick={() => c.setIsPlaying && c.setIsPlaying(p => !p)}>
            <FontAwesomeIcon icon={c.isPlaying ? faPause : faPlay} />
          </button>
          <button 
            className="icon-btn btn-next-song" 
            onClick={handleForward}
            disabled={isForwardDisabled}
          >
            <FontAwesomeIcon icon={faForwardStep} />
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
          <button className="icon-btn" onClick={() => c.setMuted && c.setMuted(m => !m)}>
            <FontAwesomeIcon icon={c.muted || c.volume === 0 ? faVolumeXmark : faVolumeHigh} />
          </button>
        </div>
      </div>
    </div>
  );
}
