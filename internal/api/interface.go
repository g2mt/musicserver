package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"musicserver/internal/progress"
	"musicserver/internal/schema"
	"musicserver/internal/searchparser"
	"musicserver/internal/taglib"

	"github.com/fsnotify/fsnotify"
)

type Interface struct {
	db     *sql.DB
	config *schema.Config // readonly
	prog   progress.Progress

	LongIdGen func(track *schema.Track) string

	// scanMu is held during a full ScanTracks call, causing WatchDataDir to pause.
	scanMu  sync.Mutex
	watcher *fsnotify.Watcher
}

const MaxIdLength = 64
const MinShortIdLength = 6
const MaxPageCount = 50

func defaultLongIdGen(track *schema.Track) string {
	hash := sha256.Sum256([]byte(track.Name + "\x00" + track.Album))
	return hex.EncodeToString(hash[:])
}

func NewInterface(config *schema.Config) (*Interface, error) {
	// Open sql database in db_path/${SQL_DB_PATH}
	dbDir := filepath.Join(config.DbDir, schema.SqlDbPath)

	// Ensure the directory exists
	if err := os.MkdirAll(config.DbDir, 0755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite3", dbDir)
	if err != nil {
		return nil, err
	}

	return &Interface{
		db:        db,
		config:    config,
		LongIdGen: defaultLongIdGen,
	}, nil
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

func (i *Interface) Close() error {
	return i.db.Close()
}

func (i *Interface) GetTracks(afterId string, search *searchparser.Result) (map[string]schema.Track, error) {
	query := "SELECT id, short_id, name, path, album FROM tracks"
	args := []interface{}{}
	whereClauses := []string{}

	if afterId != "" {
		// First, get the long ID for the afterId (which could be short or long)
		longAfterId, err := i.resolveTrackShortId(afterId)
		if err != nil {
			// If not found, treat as no afterId
			longAfterId = ""
		}
		if longAfterId != "" {
			whereClauses = append(whereClauses, "id > ?")
			args = append(args, longAfterId)
		}
	}

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
			if op.Key == "album" {
				whereClauses = append(whereClauses, "(album LIKE ?)")
				args = append(args, "%"+op.Value+"%")
			}
			// Other operators could be added here in the future
		}
	}

	// Combine WHERE clauses if any exist
	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Order by id (which is the long ID) to ensure consistent sorting
	query += " ORDER BY id LIMIT ?"
	args = append(args, MaxPageCount)

	rows, err := i.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]schema.Track)
	for rows.Next() {
		var track schema.Track
		if err := rows.Scan(&track.LongID, &track.ShortID, &track.Name, &track.Path, &track.Album); err != nil {
			return nil, err
		}
		result[track.ShortID] = track
	}
	return result, nil
}

func (i *Interface) resolveTrackShortId(id string) (string, error) {
	if len(id) == MaxIdLength {
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
		Scan(&track.LongID, &track.ShortID, &track.Name, &track.Path, &track.Album)
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

	path = filepath.Clean(path)
	relPath, err := filepath.Rel(i.config.DataPath, path)
	if err != nil {
		return nil, err
	}
	if strings.HasPrefix(relPath, "..") {
		return nil, errors.New("unexpected path outside of data directory")
	}

	bytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return bytes, nil
}

func (i *Interface) GetTrackCover(id string) ([]byte, string, error) {
	longID, err := i.resolveTrackShortId(id)
	if err != nil {
		return nil, "", err
	}

	var path string
	err = i.db.QueryRow("SELECT path FROM tracks WHERE id = ?", longID).Scan(&path)
	if err != nil {
		return nil, "", err
	}

	// Use taglib to extract cover art
	// We need to import the taglib package
	data, mimeType, err := taglib.ExtractCoverArt(path)
	if err != nil {
		return nil, "", err
	}
	return data, mimeType, nil
}

func (i *Interface) AddTrack(track *schema.Track) (string, error) {
	longID := i.LongIdGen(track)
	if len(longID) != MaxIdLength {
		panic("invalid long id")
	}
	track.LongID = longID

	// Determine short ID according to the conflict resolution algorithm
	// Start with first 6 characters
	shortID := longID[:MinShortIdLength]

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
		existingShortID := shortID

		// Determine new length for old mapping
		newLen := len(existingShortID) + 1
		if newLen > MaxIdLength {
			newLen = MaxIdLength
		}
		newOldShortID := existingLongID[:newLen]

		// Update the existing mapping to use the expanded short ID
		// We need to delete the old row and insert the new one (or update)
		// Use a transaction for consistency
		tx, err := i.db.Begin()
		if err != nil {
			return "", err
		}
		_, err = tx.Exec("UPDATE tracks SET short_id = ? WHERE id = ?", newOldShortID, existingLongID)
		if err != nil {
			tx.Rollback()
			return "", err
		}
		_, err = tx.Exec("INSERT INTO short_ids (short_id, long_id) VALUES (?, ?)", newOldShortID, existingLongID)
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
		track.LongID, track.ShortID, track.Name, track.Path, track.Album,
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

func (i *Interface) ForgetTrackByPath(path string) error {
	// First, get the absolute path to match with stored path
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	// Find the track by path
	var longID, shortID string
	err = i.db.QueryRow("SELECT id, short_id FROM tracks WHERE path = ?", absPath).Scan(&longID, &shortID)
	if err == sql.ErrNoRows {
		// Track not found, nothing to delete
		return nil
	}
	if err != nil {
		return err
	}

	// Begin a transaction to ensure consistency
	tx, err := i.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Delete from tracks table
	_, err = tx.Exec("DELETE FROM tracks WHERE id = ?", longID)
	if err != nil {
		return err
	}

	// Delete from short_ids table
	_, err = tx.Exec("DELETE FROM short_ids WHERE short_id = ?", shortID)
	if err != nil {
		return err
	}

	// Check if the album still has any tracks; if not, delete from albums
	var albumTrackCount int
	err = tx.QueryRow("SELECT COUNT(*) FROM tracks WHERE album = (SELECT album FROM tracks WHERE id = ?)", longID).Scan(&albumTrackCount)
	if err != nil {
		return err
	}
	if albumTrackCount == 0 {
		// No more tracks in this album, delete it
		_, err = tx.Exec("DELETE FROM albums WHERE name = (SELECT album FROM tracks WHERE id = ?)", longID)
		if err != nil {
			return err
		}
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
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

func (i *Interface) GetProgress() ([]byte, error) {
	return i.prog.ToJSON()
}

func (i *Interface) handleRequest(path string, method string, params map[string]string) (out []byte, contentType string, err error) {
	var response interface{}
	if path == "/track" {
		if method == "GET" {
			afterId := ""
			if afterParam, ok := params["after"]; ok {
				afterId = afterParam
			}
			var search searchparser.Result
			if searchParam, ok := params["q"]; ok {
				search = searchparser.Parse(searchParam)
				response, err = i.GetTracks(afterId, &search)
			} else {
				response, err = i.GetTracks(afterId, nil)
			}
		} else if method == "POST" {
			response, err = i.ScanTracks()
		} else if method == "DELETE" {
			success, err := i.ForgetAllTracks()
			if err != nil {
				return nil, "", err
			}
			response = success
		} else {
			return nil, "", errors.New("method not allowed")
		}
	} else if path == "/progress" {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}
		response, err = i.GetProgress()
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
		} else if id, ok = strings.CutSuffix(id, "/cover"); ok {
			data, mimeType, err := i.GetTrackCover(id)
			if err != nil {
				return nil, "", err
			}
			if data == nil {
				return nil, "", errors.New("cover not found")
			}
			return data, mimeType, nil
		} else {
			response, err = i.GetTrackById(id)
		}
	} else if path == "/album" {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		response, err = i.GetAlbums()
	} else if pageStr, ok := strings.CutPrefix(path, "/album/by-page/"); ok && len(pageStr) > 0 {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}
		page, err := strconv.Atoi(pageStr)
		if err != nil {
			return nil, "", err
		}
		response, err = i.GetAlbumsByPage(page)
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
