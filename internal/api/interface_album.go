package api

import (
	"musicserver/internal/schema"
)

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

func (i *Interface) GetAlbumsByPage(page int) ([]string, error) {
	// Calculate offset based on page number and MaxPageCount
	offset := page * MaxPageCount
	rows, err := i.db.Query("SELECT name FROM albums ORDER BY name LIMIT ? OFFSET ?", MaxPageCount, offset)
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

	tx, err := i.db.Begin()
	if err != nil {
		return schema.Album{}, err
	}

	err = tx.QueryRow("SELECT name FROM albums WHERE name = ?", name).Scan(&album.Name)
	if err != nil {
		tx.Rollback()
		return schema.Album{}, err
	}

	rows, err := tx.Query("SELECT id FROM tracks WHERE album = ?", name)
	if err != nil {
		tx.Rollback()
		return schema.Album{}, err
	}

	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			tx.Rollback()
			return schema.Album{}, err
		}
		album.Tracks = append(album.Tracks, id)
	}
	rows.Close()

	if err := tx.Commit(); err != nil {
		return schema.Album{}, err
	}

	return album, nil
}
