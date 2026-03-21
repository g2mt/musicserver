package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
)

type Track struct {
	ID      string `json:"id"`
	ShortID string `json:"short_id"`
	Name    string `json:"name"`
	Path    string `json:"path"`
	Album   string `json:"album"`
}

type Album struct {
	Name   string   `json:"name"`
	Tracks []string `json:"tracks"`
}

type Interface struct {
	db *sql.DB
}

func NewInterface(db *sql.DB) *Interface {
	return &Interface{db: db}
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

func (i *Interface) GetTrackById(id string) (Track, error) {
	longID, err := i.resolveTrackShortId(id)
	if err != nil {
		return Track{}, err
	}

	var track Track
	err = i.db.QueryRow("SELECT id, short_id, name, path, album FROM tracks WHERE id = ?", longID).
		Scan(&track.ID, &track.ShortID, &track.Name, &track.Path, &track.Album)
	if err != nil {
		return Track{}, err
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

func (i *Interface) GetAlbumByName(name string) (Album, error) {
	var album Album
	err := i.db.QueryRow("SELECT name FROM albums WHERE name = ?", name).Scan(&album.Name)
	if err != nil {
		return Album{}, err
	}

	rows, err := i.db.Query("SELECT id FROM tracks WHERE album = ?", name)
	if err != nil {
		return Album{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return Album{}, err
		}
		album.Tracks = append(album.Tracks, id)
	}
	return album, nil
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

func (i *Interface) handleRequest(path string, method string) (out []byte, contentType string, err error) {
	if method != "GET" {
		return nil, "", errors.New("method not allowed")
	}

	if path == "/track" {
		tracks, err := i.GetTracks()
		if err != nil {
			return nil, "", err
		}
		data, err := json.Marshal(tracks)
		if err != nil {
			return nil, "", err
		}
		return data, "text/json", nil
	} else if path == "/album" {
		albums, err := i.GetAlbums()
		if err != nil {
			return nil, "", err
		}
		data, err := json.Marshal(albums)
		if err != nil {
			return nil, "", err
		}
		return data, "text/json", nil
	} else if id, ok := strings.CutPrefix(path, "/track/"); ok {
		if id, ok = strings.CutSuffix(id, "/data"); ok {
			data, err := i.GetTrackData(id)
			if err != nil {
				return nil, "", err
			}
			return data, "application/octet-stream", nil
		} else {
			// Regular track by ID
			track, err := i.GetTrackById(id)
			if err != nil {
				return nil, "", err
			}
			data, err := json.Marshal(track)
			if err != nil {
				return nil, "", err
			}
			return data, "text/json", nil
		}
	} else if name, ok := strings.CutPrefix(path, "/album/"); ok {
		album, err := i.GetAlbumByName(name)
		if err != nil {
			return nil, "", err
		}
		data, err := json.Marshal(album)
		if err != nil {
			return nil, "", err
		}
		return data, "text/json", nil
	} else {
		return nil, "", errors.New("not found")
	}
}
