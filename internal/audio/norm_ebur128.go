//go:build has_ebur128

package audio

import (
	"musicserver/internal/audio/base"
	"musicserver/internal/lib/ebur128"
)

func GetLoudness(reader audio.AudioReader) (float64, error) {
	return ebur128.GetLoudness(reader)
}
