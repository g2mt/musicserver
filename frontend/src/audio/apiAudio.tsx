import { NativeAudio, onNativeMessagePort } from "src/audio/NativeAudio";
import type { AudioInterface } from "./AudioInterface";

export const apiAudio = (() => {
  if (window._native_audio_bridge) {
    window.addEventListener("message", onNativeMessagePort);
    return NativeAudio;
  } else {
    return Audio;
  }
})() as {
  new(path: string): AudioInterface;
};
