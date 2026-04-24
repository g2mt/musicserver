//go:build !has_ebur128

package audio

import (
	"errors"
	"musicserver/internal/audio/base"
)

func GetLoudness(reader audio.AudioReader) (float64, error) {
	return 0, errors.New("GetLoudness is not implemented")
}
