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

// Receives the MessagePort from the Android side and routes events to the
// active NativeAudio instance.
function setupNativeAudioMessagePort() {
  function onMessage(e: MessageEvent) {
    if (e.data !== "_audio_port") return;
    console.log("Received audio port");
    const port = e.ports[0];
    port.onmessage = (ev: MessageEvent) => {
      const { instanceId, event } = JSON.parse(ev.data) as {
        instanceId: number;
        event: string;
      };
      const instance = NativeAudio.instance;
      if (instance && instance.instanceId === instanceId) {
        instance.dispatchEvent(new Event(event));
      }
    };
    port.start();
    window.removeEventListener("message", onMessage);
  }
  window.addEventListener("message", onMessage);
}

class NativeAudio extends EventTarget {
  static instance: NativeAudio | null = null;
  static bridge = window._native_audio_bridge!;

  instanceId: number;
  private _volume: number = 1;

  constructor() {
    super();
    this.instanceId = NativeAudio.bridge.createInstance();
    NativeAudio.instance = this;
  }

  private get isActive(): boolean {
    return NativeAudio.instance?.instanceId === this.instanceId;
  }

  get src(): string {
    return "";
  }

  set src(value: string) {
    if (!this.isActive) return;
    NativeAudio.bridge.setSrc(this.instanceId, value);
  }

  get currentTime(): number {
    if (!this.isActive) return 0;
    return NativeAudio.bridge.getCurrentTime(this.instanceId);
  }

  set currentTime(value: number) {
    if (!this.isActive) return;
    NativeAudio.bridge.setCurrentTime(this.instanceId, value);
  }

  get duration(): number {
    if (!this.isActive) return 0;
    return NativeAudio.bridge.getDuration(this.instanceId);
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    if (!this.isActive) return;
    this._volume = value;
    NativeAudio.bridge.setVolume(this.instanceId, value);
  }

  play(): Promise<void> {
    if (!this.isActive) return Promise.resolve();
    NativeAudio.bridge.play(this.instanceId);
    return Promise.resolve();
  }

  pause(): void {
    if (!this.isActive) return;
    NativeAudio.bridge.pause(this.instanceId);
  }
}

export const useAbsoluteAudioPath = window._native_audio_bridge ? true : false;

export const apiAudio = (() => {
  if (window._native_audio_bridge) {
    setupNativeAudioMessagePort();
    return NativeAudio;
  } else {
    return Audio;
  }
})();
