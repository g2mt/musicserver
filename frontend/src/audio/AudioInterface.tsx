// AudioInterface.tsx
// Defines the TypeScript interface that abstracts the audio functionality
// used by the application. Both the native implementation (NativeAudio)
// and the fallback browser Audio class conform to this interface.

export interface AudioInterface {
  /** The source URL of the audio track. */
  src: string;

  /** Current playback position in seconds. */
  currentTime: number;

  /** Total duration of the audio track in seconds (read‑only). */
  readonly duration: number;

  /** Playback volume, ranging from 0 (muted) to 1 (full volume). */
  volume: number;

  /** Starts playback. Returns a promise that resolves when the play command
   * has been issued to the underlying implementation. */
  play(): Promise<void>;

  /** Pauses playback. */
  pause(): void;
}
