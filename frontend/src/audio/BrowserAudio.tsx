import type { AudioInterface } from "./AudioInterface";

export class BrowserAudio extends Audio implements AudioInterface {
  private audioContext?: AudioContext;
  private gainNode?: GainNode;
  private source?: MediaElementAudioSourceNode;

  constructor() {
    super();
    this.crossOrigin = "anonymous";
  }

  amplify(decibels: number) {
    if (decibels === 0 && !this.audioContext) {
      return;
    }

    console.log(`Amplify by ${decibels}`);

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }
      this.source = this.audioContext.createMediaElementSource(this);
      this.gainNode = this.audioContext.createGain();
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
    }

    // Convert decibels to linear gain: gain = 10^(dB/20)
    const gain = Math.pow(10, decibels / 20);
    this.gainNode!.gain.value = gain;
  }
}
