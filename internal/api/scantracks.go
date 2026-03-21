package api

import (
	"os"
	"path/filepath"

	"musicserver/internal/taglib"
)

func (i *Interface) ScanTracks() (map[string]string, error) {
	// Walk the DataPath directory recursively
	err := filepath.WalkDir(i.config.DataPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			// Skip files/directories with errors
			return nil
		}
		if d.IsDir() {
			return nil
		}

		// Try to load track metadata using taglib
		track, err := taglib.LoadTrack(path)
		if err != nil {
			// Not an audio file or error reading metadata; skip
			return nil
		}

		// Add track to database (ignore duplicate errors)
		_, err = i.AddTrack(&track)
		if err != nil {
			// If duplicate or other error, skip
			// (AddTrack may fail due to duplicate primary key, etc.)
			return nil
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Return the current list of tracks after scanning
	return i.GetTracks()
}
