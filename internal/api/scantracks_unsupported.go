//go:build android

package api

func (i *Interface) ScanTracks(args ...any) (addedFiles int, err error) {
	panic("ScanTracks called by Go code")
}

func (i *Interface) WatchDataDir() error {
	panic("WatchDataDir called by Go code")
}
