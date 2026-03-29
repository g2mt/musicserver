declare global {
  interface NativeAudioBridge {
    createInstance(): number;
    setSrc(instanceId: number, src: string): void;
    play(instanceId: number): void;
    pause(instanceId: number): void;
    setCurrentTime(instanceId: number, time: number): void;
    getCurrentTime(instanceId: number): number;
    getDuration(instanceId: number): number;
    setVolume(instanceId: number, volume: number): void;
  }
  interface Window {
    _native_audio_bridge?: NativeAudioBridge;
  }
}

class NativeAudio extends EventTarget {
  static instance: NativeAudio | null = null;

  private instanceId: number;
  private bridge: NativeAudioBridge;
  private _volume: number = 1;

  constructor() {
    super();

    this.bridge = window._native_audio_bridge!;
    this.instanceId = this.bridge.createInstance();

    NativeAudio.instance = this;
  }

  private get isActive(): boolean {
    return NativeAudio.instance === this;
  }

  get src(): string {
    return "";
  }

  set src(value: string) {
    if (!this.isActive) return;
    this.bridge.setSrc(this.instanceId, value);
  }

  get currentTime(): number {
    if (!this.isActive) return 0;
    return this.bridge.getCurrentTime(this.instanceId);
  }

  set currentTime(value: number) {
    if (!this.isActive) return;
    this.bridge.setCurrentTime(this.instanceId, value);
  }

  get duration(): number {
    if (!this.isActive) return 0;
    return this.bridge.getDuration(this.instanceId);
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    if (!this.isActive) return;
    this._volume = value;
    this.bridge.setVolume(this.instanceId, value);
  }

  play(): Promise<void> {
    if (!this.isActive) return Promise.resolve();
    this.bridge.play(this.instanceId);
    return Promise.resolve();
  }

  pause(): void {
    if (!this.isActive) return;
    this.bridge.pause(this.instanceId);
  }
}

const apiAudio = (() => {
  if (window._native_audio_bridge) {
    return NativeAudio;
  } else {
    return Audio;
  }
})();

export default apiAudio;
