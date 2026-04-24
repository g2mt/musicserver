package audio

// AudioReader is an interface for reading audio data.
type AudioReader interface {
	// Close closes the interface
	Close() error
	// GetChannels returns the number of audio channels.
	GetChannels() uint
	// GetSampleRate returns the sample rate of the audio.
	GetSampleRate() uint
	// ReadFrames reads up to nframes and returns the number of frames read and the buffer.
	// The number of float64 items in the returned buffer equals frames * number of channels.
	ReadFrames(nframes uint) (uint, []float64)
}
