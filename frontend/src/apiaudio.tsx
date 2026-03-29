declare global {
  interface NativeAudioBridge {
    // TODO: ...
  }
  interface Window {
    _native_audio_bridge?: NativeAudioBridge;
  }
}

class NativeAudio {
  // TODO: ...
  static instance: NativeAudio | null = null;
}

const apiAudio = (() => {
  if (window._native_audio_bridge) {
    return NativeAudio;
  } else {
    return Audio;
  }
})();

export default apiAudio;
