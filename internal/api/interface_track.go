package api

import (
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"musicserver/internal/schema"
	"musicserver/internal/searchparser"
	"musicserver/internal/taglib"
)

type TrackListResult struct {
	Filters map[string]string `json:"filters"`
	Limit   int               `json:"limit"`
	Tracks  []schema.Track    `json:"tracks"`
}

func (i *Interface) GetTracks(search *searchparser.Result, limit int) (TrackListResult, error) {
	var err error
	args := []interface{}{}

	whereClauses := []string{}

	var longBeforeId string
	var longAfterId string

	// Sorting variables
	sortColumn := "id"
	sortDesc := false

	// Apply search filters if search is not nil
	if search != nil {
		// Apply word filters
		orClauses := []string{}
		for _, word := range search.Words {
			orClauses = append(orClauses, "(name LIKE ?)")
			args = append(args, "%"+word+"%")
		}
		if len(orClauses) > 0 {
			whereClauses = append(whereClauses, strings.Join(orClauses, " OR "))
		}

		// Apply negated word filters
		for _, negated := range search.Negated {
			whereClauses = append(whereClauses, "(name NOT LIKE ?)")
			args = append(args, "%"+negated+"%")
		}

		// Apply operator filters
		for _, op := range search.Operators {
			switch op.Key {
			case "after":
				if id, err := i.resolveTrackShortId(op.Value, nil); err == nil {
					longAfterId = id
				}
			case "before":
				if id, err := i.resolveTrackShortId(op.Value, nil); err == nil {
					longBeforeId = id
				}
			case "album":
				whereClauses = append(whereClauses, "(album LIKE ?)")
				args = append(args, "%"+op.Value+"%")
			case "artist":
				whereClauses = append(whereClauses, "(artist LIKE ?)")
				args = append(args, "%"+op.Value+"%")
			case "path":
				path := filepath.Join(i.config.DataPath, op.Value)
				whereClauses = append(whereClauses, "(path LIKE ?)")
				args = append(args, path+"%")
			case "sort":
				switch op.Value {
				case "id", "name", "path", "artist", "album":
					sortColumn = op.Value
				}
			case "desc":
				if op.Value == "1" {
					sortDesc = true
				}
			}
		}
	}

	// Ordering
	if limit == 0 {
		limit = MaxPageCount
	}

	// Ordering
	orderByClause := "ORDER BY " + sortColumn
	if sortDesc {
		orderByClause += " DESC"
	}

	// Build SQL query
	SelectedColsFromTracks := "id, short_id, name, path, artist, album"
	var query string

	var whereClause string
	if len(whereClauses) > 0 {
		whereClause = " WHERE " + strings.Join(whereClauses, " AND ")
	}
	var limitClause string
	if limit > 0 {
		limitClause = fmt.Sprintf("LIMIT %d", limit)
		args = append(args, limit)
	}

	if longBeforeId == "" && longAfterId == "" {
		// no range specified
		query = fmt.Sprintf("SELECT %s FROM tracks %s %s %s",
			SelectedColsFromTracks,
			whereClause,
			orderByClause,
			limitClause)
	} else {
		// before/after ID specified
		var outerWhereClauses []string
		if longBeforeId != "" {
			outerWhereClauses = append(outerWhereClauses,
				"_rank < (SELECT _rank FROM _ranked WHERE id = ?)")
			args = append(args, longBeforeId)
		}
		if longAfterId != "" {
			outerWhereClauses = append(outerWhereClauses,
				"_rank > (SELECT _rank FROM _ranked WHERE id = ?)")
			args = append(args, longAfterId)
		}
		query = fmt.Sprintf(`
			WITH _ranked AS (
				SELECT
					%s, -- SelectedColsFromTracks
					ROW_NUMBER() OVER (%s) AS _rank -- orderByClause
				FROM tracks
			)
			SELECT %s FROM (
				SELECT * FROM _ranked
				AS _sub
				WHERE %s -- outerWhereClauses
				ORDER BY _rank
			)
		`, SelectedColsFromTracks,
			orderByClause,
			SelectedColsFromTracks,
			strings.Join(outerWhereClauses, " "),
		)
	}
	slog.Debug("SQL query for search: ")
	slog.Debug(query)

	rows, err := i.db.Query(query, args...)
	if err != nil {
		slog.Debug("Unable to query", "err", err)
		return TrackListResult{}, err
	}
	defer rows.Close()

	var tracks []schema.Track
	for rows.Next() {
		var track schema.Track
		if err := rows.Scan(&track.LongID, &track.ShortID, &track.Name, &track.Path, &track.Artist, &track.Album); err != nil {
			return TrackListResult{}, err
		}
		tracks = append(tracks, track)
	}

	// Prepare filters map for response
	filters := make(map[string]string)
	if search != nil {
		for _, op := range search.Operators {
			filters[op.Key] = op.Value
		}
	}

	return TrackListResult{
		Filters: filters,
		Limit:   limit,
		Tracks:  tracks,
	}, nil
}

func (i *Interface) GetAllTrackPaths() ([]string, error) {
	rows, err := i.db.Query("SELECT path FROM tracks")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}
	return paths, nil
}

// Resolves a short id to a long ID
func (i *Interface) resolveTrackShortId(id string, tx *sql.Tx) (string, error) {
	if len(id) == MaxIdLength {
		return id, nil
	}

	db := i.getQueryRow(tx)

	var longID string
	err := db.QueryRow("SELECT long_id FROM short_ids WHERE short_id = ?", id).Scan(&longID)
	if err != nil {
		return "", errors.New("track not found")
	}
	return longID, nil
}

// Resolves a path to long ID. Requires path to be in the data directory
func (i *Interface) resolveTrackFromPath(path string, tx *sql.Tx) (string, error) {
	db := i.getQueryRow(tx)

	var longID string
	err := db.QueryRow("SELECT id FROM tracks WHERE path = ?", path).Scan(&longID)
	if err != nil {
		return "", errors.New("track not found")
	}
	return longID, nil
}

func (i *Interface) GetTrackById(id string) (schema.Track, error) {
	tx, err := i.db.Begin()
	if err != nil {
		return schema.Track{}, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	longID, err := i.resolveTrackShortId(id, tx)
	if err != nil {
		return schema.Track{}, err
	}

	var track schema.Track
	err = tx.QueryRow("SELECT id, short_id, name, path, artist, album FROM tracks WHERE id = ?", longID).
		Scan(&track.LongID, &track.ShortID, &track.Name, &track.Path, &track.Artist, &track.Album)
	if err != nil {
		return schema.Track{}, err
	}
	if !strings.HasPrefix(track.Path, i.config.DataPath) {
		panic("track.Path stores invalid prefix")
	}

	err = tx.Commit()
	if err != nil {
		return schema.Track{}, err
	}

	return track, nil
}

func (i *Interface) GetTrackData(id string) ([]byte, error) {
	tx, err := i.db.Begin()
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	longID, err := i.resolveTrackShortId(id, tx)
	if err != nil {
		return nil, err
	}

	var path string
	err = tx.QueryRow("SELECT path FROM tracks WHERE id = ?", longID).Scan(&path)
	if err != nil {
		return nil, err
	}

	path = filepath.Clean(path)
	relPath, err := filepath.Rel(i.config.DataPath, path)
	if err != nil {
		return nil, err
	}
	if strings.HasPrefix(relPath, "..") {
		return nil, errors.New("unexpected path outside of data directory")
	}

	err = tx.Commit()
	if err != nil {
		return nil, err
	}

	bytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return bytes, nil
}

func (i *Interface) GetTrackCover(id string) ([]byte, string, error) {
	tx, err := i.db.Begin()
	if err != nil {
		return nil, "", err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	longID, err := i.resolveTrackShortId(id, tx)
	if err != nil {
		return nil, "", err
	}

	var path string
	err = tx.QueryRow("SELECT path FROM tracks WHERE id = ?", longID).Scan(&path)
	if err != nil {
		return nil, "", err
	}

	err = tx.Commit()
	if err != nil {
		return nil, "", err
	}

	// Check cache first
	cachedData, mimeType, cErr := i.getTrackCoverCached(path)
	if cachedData != nil {
		slog.Debug("Cover cache hit", "path", path)
		return cachedData, mimeType, nil
	} else if cErr != nil {
		slog.Warn("Unable to complete cache transaction", "err", cErr)
	}

	// Use taglib to extract cover art
	data, mimeType, err := taglib.ExtractCoverArt(path)
	if err != nil {
		return nil, "", err
	}

	// Cache the result if cache db is available
	if i.ccacheDb != nil && data != nil {
		select {
		case i.ccacheChan <- coverCacheData{
			path:     path,
			data:     data,
			mimeType: mimeType,
		}:
		default:
		}
	}

	return data, mimeType, nil
}

func (i *Interface) GetTrackFileChecksumInfo(path string) (
	ckLastModified int64,
	ckSize int64,
	err error,
) {
	err = i.db.QueryRow("SELECT ck_last_modified, ck_size FROM tracks WHERE path = ?", path).Scan(&ckLastModified, &ckSize)
	if err != nil {
		return 0, 0, err
	}
	return ckLastModified, ckSize, nil
}

func (i *Interface) AddTrack(track *schema.Track) (string, error) {
	longID := i.LongIdGen(track)
	if len(longID) != MaxIdLength {
		panic("invalid long id")
	}
	track.LongID = longID

	var ckLastModified int64
	var ckSize int64
	if !i.config.IgnoreTrackPath {
		if fileInfo, err := os.Stat(track.Path); err == nil {
			ckLastModified = fileInfo.ModTime().Unix()
			ckSize = fileInfo.Size()
		} else {
			slog.Warn("cannot open track.Path", "path", track.Path)
		}
	}

	// Start a single transaction for the entire operation
	tx, err := i.db.Begin()
	if err != nil {
		return "", err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Check if long id already exists in tracks table
	var existingShortID string
	err = tx.QueryRow("SELECT short_id FROM tracks WHERE id = ?", longID).Scan(&existingShortID)
	if err == nil {
		// Track already exists, update it
		_, err = tx.Exec(
			"UPDATE tracks SET name = ?, path = ?, artist = ?, album = ?, ck_last_modified = ?, ck_size = ? WHERE id = ?",
			track.Name, track.Path, track.Artist, track.Album, ckLastModified, ckSize, longID,
		)
		if err != nil {
			return "", err
		}
		track.ShortID = existingShortID
		err = tx.Commit()
		if err != nil {
			return "", err
		}
		return track.ShortID, nil
	} else if err != sql.ErrNoRows {
		return "", err
	}

	// Track doesn't exist, create a short ID

	// Determine short ID according to the conflict resolution algorithm
	// Start with first 6 characters
	shortID := longID[:MinShortIdLength]

	// We need to insert into short_ids mapping, handling conflicts
	// Use a loop to resolve conflicts
	for {
		// Try to insert the mapping shortID -> longID
		// First, check if shortID already exists
		var existingLongID string
		err := tx.QueryRow("SELECT long_id FROM short_ids WHERE short_id = ?", shortID).Scan(&existingLongID)
		if err == sql.ErrNoRows {
			// No conflict, insert and break
			_, err = tx.Exec("INSERT INTO short_ids (short_id, long_id) VALUES (?, ?)", shortID, longID)
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
		existingShortID := shortID

		// Determine new length for old mapping
		newLen := len(existingShortID) + 1
		if newLen > MaxIdLength {
			newLen = MaxIdLength
		}
		newOldShortID := existingLongID[:newLen]

		// Update the existing mapping to use the expanded short ID
		// We need to delete the old row and insert the new one (or update)
		_, err = tx.Exec("UPDATE tracks SET short_id = ? WHERE id = ?", newOldShortID, existingLongID)
		if err != nil {
			return "", err
		}
		_, err = tx.Exec("INSERT INTO short_ids (short_id, long_id) VALUES (?, ?)", newOldShortID, existingLongID)
		if err != nil {
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
			return "", err
		}
		// After successful insertion, break
		break
	}

	// Set track's short_id field
	track.ShortID = shortID

	// Insert track into tracks table
	_, err = tx.Exec(
		"INSERT INTO tracks (id, short_id, name, path, artist, album, ck_last_modified, ck_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		track.LongID, track.ShortID, track.Name, track.Path, track.Artist, track.Album, ckLastModified, ckSize,
	)
	if err != nil {
		return "", err
	}

	// Ensure album exists in albums table
	_, err = tx.Exec("INSERT OR IGNORE INTO albums (name) VALUES (?)", track.Album)
	if err != nil {
		return "", err
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		return "", err
	}

	return track.ShortID, nil
}

func (i *Interface) ForgetAllTracks() (bool, error) {
	// Start a transaction to ensure atomic deletion
	tx, err := i.db.Begin()
	if err != nil {
		return false, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Delete all rows from tracks table
	_, err = tx.Exec("DELETE FROM tracks")
	if err != nil {
		return false, err
	}

	// Delete all rows from short_ids table
	_, err = tx.Exec("DELETE FROM short_ids")
	if err != nil {
		return false, err
	}

	// Delete all rows from albums table
	_, err = tx.Exec("DELETE FROM albums")
	if err != nil {
		return false, err
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		return false, err
	}

	return true, nil
}

func (i *Interface) forgetTrack(tx *sql.Tx, longID, shortID string) error {
	var album string
	err := tx.QueryRow("SELECT album FROM tracks WHERE id = ?", longID).Scan(&album)
	if err != nil {
		return err
	}

	if _, err := tx.Exec("DELETE FROM tracks WHERE id = ?", longID); err != nil {
		return err
	}

	if _, err := tx.Exec("DELETE FROM short_ids WHERE short_id = ?", shortID); err != nil {
		return err
	}

	var albumTrackCount int
	err = tx.QueryRow("SELECT COUNT(*) FROM tracks WHERE album = ?", album).Scan(&albumTrackCount)
	if err != nil {
		return err
	}

	if albumTrackCount == 0 {
		if _, err := tx.Exec("DELETE FROM albums WHERE name = ?", album); err != nil {
			return err
		}
	}

	return nil
}

func (i *Interface) ForgetTrackById(id string) error {
	tx, err := i.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	longID, err := i.resolveTrackShortId(id, tx)
	if err != nil {
		return err
	}

	var shortID string
	err = tx.QueryRow("SELECT short_id FROM tracks WHERE id = ?", longID).Scan(&shortID)
	if err != nil {
		return err
	}

	if err := i.forgetTrack(tx, longID, shortID); err != nil {
		return err
	}

	return tx.Commit()
}

func (i *Interface) ForgetTrackByPath(path string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	var longID, shortID string
	err = i.db.QueryRow(
		"SELECT id, short_id FROM tracks WHERE (path = ?) OR (substr(path, ?) = ?)",
		absPath, -(len(absPath)+1), absPath+"/",
	).Scan(&longID, &shortID)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}

	tx, err := i.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	if err := i.forgetTrack(tx, longID, shortID); err != nil {
		return err
	}

	return tx.Commit()
}
