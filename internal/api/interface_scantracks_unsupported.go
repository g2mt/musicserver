//go:build android

package api

import "errors"

func (i *Interface) ScanTracks(args ...any) (addedFiles int, err error) {
	return 0, errors.New("ScanTracks called by Go code")
}

func (i *Interface) WatchDataDir() error {
	return errors.New("WatchDataDir called by Go code")
}
