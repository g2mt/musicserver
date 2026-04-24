//go:build has_sndfile

package audio

import (
	"musicserver/internal/audio/base"
	"musicserver/internal/lib/sndfile"
)

func NewReader(path string) (audio.AudioReader, error) {
	return libsndfile.NewSfReader(path)
}
