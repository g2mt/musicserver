package ebur128

// #include "ebur128.h"
import "C"
import (
	"errors"
	"unsafe"

	"musicserver/internal/audio"
)

// GetLoudness returns the integrated loudness in LUFS.
func GetLoudness(reader audio.AudioReader) (float64, error) {
	channels := reader.GetChannels()
	rate := reader.GetSampleRate()

	state := C.ebur128_init(C.uint(channels), C.ulong(rate), C.EBUR128_MODE_I)
	if state == nil {
		return 0, errors.New("ebur128: init failed")
	}
	defer C.ebur128_destroy(&state)

	for {
		numFrames, buffer := reader.ReadFrames(rate)
		if numFrames == 0 {
			break
		}

		if C.ebur128_add_frames_double(state, (*C.double)(unsafe.Pointer(&buffer[0])), C.size_t(numFrames)) != C.EBUR128_SUCCESS {
			return 0, errors.New("ebur128: failed to add frames")
		}
	}

	var loudness C.double
	if C.ebur128_loudness_global(state, &loudness) != C.EBUR128_SUCCESS {
		return 0, errors.New("ebur128: failed to get loudness")
	}

	return float64(loudness), nil
}
