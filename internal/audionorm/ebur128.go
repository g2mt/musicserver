//go:build has_ebur128

package audionorm

import (
	"musicserver/internal/audio"
	"musicserver/internal/lib/ebur128"
)

func GetLoudness(reader audio.AudioReader) (float64, error) {
	return ebur128.GetLoudness(reader)
}
