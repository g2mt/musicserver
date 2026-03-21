package api

import (
	"os"
	"path/filepath"

	"musicserver/internal/taglib"
)

func (i *Interface) ScanTracks() (map[string]string, error) {
	added := make(map[string]string)

	err := filepath.WalkDir(i.config.DataPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}

		track, err := taglib.LoadTrack(path)
		if err != nil {
			return nil
		}

		// Add track to database (ignore duplicate errors)
		shortID, err := i.AddTrack(&track)
		if err != nil {
			return nil
		}

		// Successfully added, record in result map
		added[shortID] = track.Name
		return nil
	})

	if err != nil {
		return nil, err
	}

	return added, nil
}
