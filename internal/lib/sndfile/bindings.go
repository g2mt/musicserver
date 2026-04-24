package libsndfile

// #cgo pkg-config: sndfile
import "C"
import (
	"errors"
	"unsafe"

	"musicserver/internal/audio/base"
)

// sfReader implements the audio.AudioReader interface using libsndfile.
type sfReader struct {
	file       *C.SNDFILE
	info       C.SF_INFO
	channels   uint
	samplerate uint
}

// GetChannels returns the number of channels of the opened file.
func (r *sfReader) GetChannels() uint {
	return r.channels
}

// GetSampleRate returns the sample rate of the opened file.
func (r *sfReader) GetSampleRate() uint {
	return r.samplerate
}

// ReadFrames reads up to nframes from the file and returns the number of frames read
// together with a slice containing the interleaved float64 samples.
func (r *sfReader) ReadFrames(nframes uint) (uint, []float64) {
	if nframes == 0 {
		return 0, nil
	}
	totalSamples := int(nframes) * int(r.channels)
	buf := make([]float64, totalSamples)

	// Read frames as double‑precision floating‑point values.
	read := C.sf_readf_double(r.file, (*C.double)(unsafe.Pointer(&buf[0])), C.sf_count_t(nframes))
	if read <= 0 {
		return 0, nil
	}
	framesRead := uint(read)
	return framesRead, buf[:int(framesRead)*int(r.channels)]
}

// NewSfReader opens the file at the given path and returns an AudioReader.
// It returns an error if the file cannot be opened.
func NewSfReader(path string) (audio.AudioReader, error) {
	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))

	var info C.SF_INFO
	// Zero‑initialize the SF_INFO struct.
	C.memset(unsafe.Pointer(&info), 0, C.size_t(unsafe.Sizeof(info)))

	file := C.sf_open(cpath, C.SFM_READ, &info)
	if file == nil {
		return nil, errors.New("libsndfile: failed to open file")
	}

	reader := &sfReader{
		file:       file,
		info:       info,
		channels:   uint(info.channels),
		samplerate: uint(info.samplerate),
	}
	return reader, nil
}

// Close releases the underlying libsndfile resources.
func (r *sfReader) Close() error {
	if r.file != nil {
		if C.sf_close(r.file) != 0 {
			return errors.New("libsndfile: failed to close file")
		}
		r.file = nil
	}
	return nil
}
