//go:build !has_sndfile

package audio

import (
	"errors"
	"musicserver/internal/audio/base"
)

func NewReader(path string) (audio.AudioReader, error) {
	return nil, errors.New("no implementation for NewReader")
}
