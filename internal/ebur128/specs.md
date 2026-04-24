# ebur128

Go bindings to the ebur128 library for replay gain.

Exports the following function:

`GetLoudness(AudioReader) -> f64`, returning the integrated loudness in LUFS

where AudioReader is an interface with in the following functions:

- GetChannels() -> uint
- GetSampleRate() -> uint
- ReadFrames(nframes) -> []double // The number of double items actually read/written = frames * number of channels.
