import type { AudioInterface } from "./AudioInterface";
import { BrowserAudio } from "./BrowserAudio";

import { NativeAudio, onNativeMessagePort } from "src/audio/NativeAudio";

export const usesAbsoluteAudioPath = window._native_audio_bridge ? true : false;

export const apiAudio = (() => {
  if (window._native_audio_bridge) {
    window.addEventListener("message", onNativeMessagePort);
    return NativeAudio;
  } else {
    return BrowserAudio;
  }
})() as {
  new (): AudioInterface;
};
