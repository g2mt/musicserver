package api

import (
	"database/sql"
	"errors"
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
			name TEXT PRIMARY KEY,
			tracks TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS short_ids (
			short_id TEXT PRIMARY KEY,
			long_id TEXT NOT NULL
		);
	`)
	return err
}

func (i *Interface) getTracks() (map[string]string, error) {
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

func (i *Interface) getTrackById(id string) (Track, error) {
	longID, err := i.resolveShortID(id)
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

func (i *Interface) getTrackData(id string) ([]byte, error) {
	longID, err := i.resolveShortID(id)
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

func (i *Interface) getAlbums() ([]string, error) {
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

func (i *Interface) getAlbumByName(name string) (Album, error) {
	var album Album
	var tracksJSON string
	err := i.db.QueryRow("SELECT name, tracks FROM albums WHERE name = ?", name).
		Scan(&album.Name, &tracksJSON)
	if err != nil {
		return Album{}, err
	}
	// Parse tracks JSON string into []string
	album.Tracks = []string{tracksJSON}
	return album, nil
}

func (i *Interface) resolveShortID(id string) (string, error) {
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
