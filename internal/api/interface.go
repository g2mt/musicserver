package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"

	"musicserver/internal/schema"
)

type Interface struct {
	db     *sql.DB
	config *schema.Config // readonly
}

func NewInterface(db *sql.DB, config *schema.Config) *Interface {
	return &Interface{db: db, config: config}
}

func (i *Interface) InitDb() error {
	_, err := i.db.Exec(`
		CREATE TABLE IF NOT EXISTS tracks (
			id TEXT PRIMARY KEY,
			short_id TEXT NOT NULL,
			name TEXT NOT NULL,
			path TEXT NOT NULL,
			album TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS albums (
			name TEXT PRIMARY KEY
		);
		CREATE TABLE IF NOT EXISTS short_ids (
			short_id TEXT PRIMARY KEY,
			long_id TEXT NOT NULL
		);
	`)
	return err
}

func (i *Interface) GetTracks() (map[string]string, error) {
	rows, err := i.db.Query("SELECT short_id, name FROM tracks")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var shortID, name string
		if err := rows.Scan(&shortID, &name); err != nil {
			return nil, err
		}
		result[shortID] = name
	}
	return result, nil
}

func (i *Interface) resolveTrackShortId(id string) (string, error) {
	if len(id) == 64 {
		return id, nil
	}

	var longID string
	err := i.db.QueryRow("SELECT long_id FROM short_ids WHERE short_id = ?", id).Scan(&longID)
	if err != nil {
		return "", errors.New("track not found")
	}
	return longID, nil
}

func (i *Interface) GetTrackById(id string) (schema.Track, error) {
	longID, err := i.resolveTrackShortId(id)
	if err != nil {
		return schema.Track{}, err
	}

	var track schema.Track
	err = i.db.QueryRow("SELECT id, short_id, name, path, album FROM tracks WHERE id = ?", longID).
		Scan(&track.ID, &track.ShortID, &track.Name, &track.Path, &track.Album)
	if err != nil {
		return schema.Track{}, err
	}
	return track, nil
}

func (i *Interface) GetTrackData(id string) ([]byte, error) {
	longID, err := i.resolveTrackShortId(id)
	if err != nil {
		return nil, err
	}

	var path string
	err = i.db.QueryRow("SELECT path FROM tracks WHERE id = ?", longID).Scan(&path)
	if err != nil {
		return nil, err
	}

	return []byte(path), nil
}

func (i *Interface) AddTrack(track *schema.Track) (string, error) {
	// Calculate long ID as hex representation of sha256sum(name+'\0'+album)
	// We'll use crypto/sha256
	hash := sha256.Sum256([]byte(track.Name + "\x00" + track.Album))
	longID := hex.EncodeToString(hash[:])
	track.ID = longID

	// Determine short ID according to the conflict resolution algorithm
	// Start with first 6 characters
	shortID := longID[:6]

	// We need to insert into short_ids mapping, handling conflicts
	// Use a loop to resolve conflicts
	for {
		// Try to insert the mapping shortID -> longID
		// First, check if shortID already exists
		var existingLongID string
		err := i.db.QueryRow("SELECT long_id FROM short_ids WHERE short_id = ?", shortID).Scan(&existingLongID)
		if err == sql.ErrNoRows {
			// No conflict, insert and break
			_, err = i.db.Exec("INSERT INTO short_ids (short_id, long_id) VALUES (?, ?)", shortID, longID)
			if err != nil {
				return "", err
			}
			break
		} else if err != nil {
			// Some other database error
			return "", err
		}

		// Conflict: existingLongID is the ID already mapped to this shortID
		// Expand both short IDs by one character
		// First, expand the existing mapping's short ID
		oldShortID := shortID
		oldLongID := existingLongID

		// Determine new length for old mapping
		newLen := len(oldShortID) + 1
		if newLen > 64 {
			newLen = 64
		}
		// Ensure we don't exceed the length of the long ID
		if newLen > len(oldLongID) {
			newLen = len(oldLongID)
		}
		newOldShortID := oldLongID[:newLen]

		// Update the existing mapping to use the expanded short ID
		// We need to delete the old row and insert the new one (or update)
		// Use a transaction for consistency
		tx, err := i.db.Begin()
		if err != nil {
			return "", err
		}
		_, err = tx.Exec("DELETE FROM short_ids WHERE short_id = ?", oldShortID)
		if err != nil {
			tx.Rollback()
			return "", err
		}
		_, err = tx.Exec("INSERT INTO short_ids (short_id, long_id) VALUES (?, ?)", newOldShortID, oldLongID)
		if err != nil {
			tx.Rollback()
			return "", err
		}

		// Now expand the current track's short ID similarly
		if newLen > len(longID) {
			newLen = len(longID)
		}
		shortID = longID[:newLen]

		// Try to insert the current mapping with the expanded shortID
		// We'll continue the loop to check for conflicts again
		_, err = tx.Exec("INSERT INTO short_ids (short_id, long_id) VALUES (?, ?)", shortID, longID)
		if err != nil {
			tx.Rollback()
			return "", err
		}
		err = tx.Commit()
		if err != nil {
			return "", err
		}
		// After successful insertion, break
		break
	}

	// Set track's short_id field
	track.ShortID = shortID

	// Insert track into tracks table
	_, err := i.db.Exec(
		"INSERT INTO tracks (id, short_id, name, path, album) VALUES (?, ?, ?, ?, ?)",
		track.ID, track.ShortID, track.Name, track.Path, track.Album,
	)
	if err != nil {
		return "", err
	}

	// Ensure album exists in albums table
	_, err = i.db.Exec("INSERT OR IGNORE INTO albums (name) VALUES (?)", track.Album)
	if err != nil {
		return "", err
	}

	return track.ShortID, nil
}

func (i *Interface) GetAlbums() ([]string, error) {
	rows, err := i.db.Query("SELECT name FROM albums")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var albums []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		albums = append(albums, name)
	}
	return albums, nil
}

func (i *Interface) GetAlbumByName(name string) (schema.Album, error) {
	var album schema.Album
	err := i.db.QueryRow("SELECT name FROM albums WHERE name = ?", name).Scan(&album.Name)
	if err != nil {
		return schema.Album{}, err
	}

	rows, err := i.db.Query("SELECT id FROM tracks WHERE album = ?", name)
	if err != nil {
		return schema.Album{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return schema.Album{}, err
		}
		album.Tracks = append(album.Tracks, id)
	}
	return album, nil
}

func (i *Interface) handleRequest(path string, method string) (out []byte, contentType string, err error) {
	var response interface{}
	if path == "/track" {
		if method == "GET" {
			response, err = i.GetTracks()
		} else if method == "POST" {
			response, err = i.ScanTracks()
		} else {
			return nil, "", errors.New("method not allowed")
		}
	} else if path == "/album" {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		response, err = i.GetAlbums()
	} else if id, ok := strings.CutPrefix(path, "/track/"); ok {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		if id, ok = strings.CutSuffix(id, "/data"); ok {
			data, err := i.GetTrackData(id)
			if err != nil {
				return nil, "", err
			}
			return data, "application/octet-stream", nil
		} else {
			response, err = i.GetTrackById(id)
		}
	} else if name, ok := strings.CutPrefix(path, "/album/"); ok {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		response, err = i.GetAlbumByName(name)
	} else {
		return nil, "", errors.New("invalid api request")
	}

	if err != nil {
		return nil, "", err
	}

	data, err := json.Marshal(response)
	if err != nil {
		return nil, "", err
	}
	return data, "text/json", nil
}
