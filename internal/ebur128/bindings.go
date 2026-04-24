package ebur128

/*
#cgo CFLAGS: -I../../vendored/libebur128/ebur128
#include "ebur128.h"
*/
import "C"
import (
	"math"
	"unsafe"
)

// AudioReader is an interface for reading audio data.
type AudioReader interface {
	GetChannels() uint
	GetSampleRate() uint
	// ReadFrames reads nframes and returns the samples.
	// The number of double items actually read = frames * number of channels.
	ReadFrames(nframes uint) []float64
}

// GetLoudness returns the integrated loudness in LUFS.
func GetLoudness(reader AudioReader) float64 {
	channels := reader.GetChannels()
	rate := reader.GetSampleRate()

	state := C.ebur128_init(C.uint(channels), C.ulong(rate), C.EBUR128_MODE_I)
	if state == nil {
		panic("ebur128: init failed")
	}
	defer C.ebur128_destroy(&state)

	for {
		frames := reader.ReadFrames(rate)
		if len(frames) == 0 {
			break
		}

		numFrames := len(frames) / int(channels)
		if numFrames == 0 {
			break
		}

		C.ebur128_add_frames_double(state, (*C.double)(unsafe.Pointer(&frames[0])), C.size_t(numFrames))
	}

	var loudness C.double
	if C.ebur128_loudness_global(state, &loudness) != C.EBUR128_SUCCESS {
		return math.Inf(-1)
	}

	return float64(loudness)
}
