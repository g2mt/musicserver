package api

import (
	"musicserver/internal/audio"
)

// GetTrackLoudness returns the loudness (LUF) of a track identified by its short or long ID.
func (i *Interface) GetTrackLoudness(id string) (float64, error) {
	tx, err := i.db.Begin()
	if err != nil {
		return 0, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	longID, err := i.resolveTrackShortId(id, tx)
	if err != nil {
		return 0, err
	}

	var path string
	err = tx.QueryRow("SELECT path FROM tracks WHERE id = ?", longID).Scan(&path)
	if err != nil {
		return 0, err
	}

	// Create an audio reader (implementation dependent)
	reader, err := audio.NewReader(path)
	if err != nil {
		return 0, err
	}

	// Compute loudness using the audionorm package
	loudness, err := audio.GetLoudness(reader)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return loudness, nil
}
