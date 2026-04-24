//go:build !has_ebur128

package audionorm

import (
	"errors"
	"musicserver/internal/audio"
)

func GetLoudness(reader audio.AudioReader) (float64, error) {
	return 0, errors.New("GetLoudness is not implemented")
}
