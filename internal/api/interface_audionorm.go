package api

import (
	"musicserver/internal/audionorm"
	"os"
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

	// Open the audio file
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	// Create an audio reader (implementation dependent)
	reader, err := audio.NewReader(f)
	if err != nil {
		return 0, err
	}

	// Compute loudness using the audionorm package
	loudness, err := audionorm.GetLoudness(reader)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return loudness, nil
}
