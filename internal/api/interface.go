package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"musicserver/internal/progress"
	"musicserver/internal/schema"
	"musicserver/internal/searchparser"

	"github.com/fsnotify/fsnotify"
	lru "github.com/hashicorp/golang-lru/v2"
)

type Interface struct {
	db      *sql.DB
	cacheDb *sql.DB // nullable

	config *schema.Config // readonly
	prog   *progress.Progress

	LongIdGen func(track *schema.Track) string

	// scanMu is held during a full ScanTracks call, causing WatchDataDir to pause.
	scanMu  sync.Mutex
	watcher *fsnotify.Watcher

	trackCache *lru.Cache[string, schema.Track]

	// dlExternal stores the state of ongoing external downloads
	dlExternal   map[string]dlExternal
	dlExternalMu sync.Mutex
}

const SqlDbPath = "./info.db"
const MaxIdLength = 64
const MinShortIdLength = 6
const MaxPageCount = 50

const CacheDbPath = "./cache.db"
const CacheMaxBytes = 512 * 1024 * 1024 // 512 Mb

func defaultLongIdGen(track *schema.Track) string {
	hash := sha256.Sum256([]byte(track.Name + "\x00" + track.Album))
	return hex.EncodeToString(hash[:])
}

func NewInterface(config *schema.Config) (*Interface, error) {
	// Open sql database in db_path/${SQL_DB_PATH}
	dbDir := filepath.Join(config.DbDir, SqlDbPath)

	// Ensure the directory exists
	if err := os.MkdirAll(config.DbDir, 0755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite3", dbDir)
	if err != nil {
		return nil, err
	}

	// Open cache database
	cacheDbDir := filepath.Join(config.DbDir, CacheDbPath)
	cacheDb, err := sql.Open("sqlite3", cacheDbDir)
	if err != nil {
		return nil, err
	}

	trackCache, _ := lru.New[string, schema.Track](32)

	return &Interface{
		db:         db,
		cacheDb:    cacheDb,
		config:     config,
		prog:       progress.NewProgress(),
		LongIdGen:  defaultLongIdGen,
		trackCache: trackCache,
	}, nil
}

func (i *Interface) InitDb() error {
	_, err := i.db.Exec(`
		CREATE TABLE IF NOT EXISTS tracks (
			id TEXT PRIMARY KEY,
			short_id TEXT NOT NULL,
			name TEXT NOT NULL,
			path TEXT NOT NULL,
			artist TEXT NOT NULL,
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

	// Initialize cache db if available
	if i.cacheDb != nil {
		_, err = i.cacheDb.Exec(`
			CREATE TABLE IF NOT EXISTS cover_cache (
				path TEXT PRIMARY KEY,
				data BLOB NOT NULL,
				mime_type TEXT NOT NULL,
				timestamp INTEGER NOT NULL DEFAULT 0
			);
			CREATE TABLE IF NOT EXISTS stats (
				key TEXT PRIMARY KEY,
				value INTEGER NOT NULL
			);
			INSERT OR IGNORE INTO stats (key, value) VALUES ('size', 0);
		`)
	}

	return err
}

func (i *Interface) CleanCache() error {
	if i.cacheDb == nil {
		return nil
	}

	_, err := i.cacheDb.Exec("DELETE FROM cover_cache")
	return err
}

func (i *Interface) Close() error {
	if err := i.db.Close(); err != nil {
		return err
	}
	if i.cacheDb != nil {
		if err := i.cacheDb.Close(); err != nil {
			return err
		}
	}
	return nil
}

// out is either []byte, or io.ReadCloser
func (i *Interface) handleRequest(path string, method string, params map[string]string) (out handler, contentType string, err error) {
	var response interface{}
	if path == "/track" {
		if method == "GET" {
			var search searchparser.Result
			if searchParam, ok := params["q"]; ok {
				search = searchparser.Parse(searchParam)
				response, err = i.GetTracks(&search)
			} else {
				response, err = i.GetTracks(nil)
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
		data, err := i.GetProgress()
		if err != nil {
			return nil, "", err
		}
		return &byteHandler{b: data}, "text/json", nil
	} else if path == "/progress/:events" {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}
		return streamEvents(i, i.prog.ListenEvents(), i.prog.UnlistenEvents)
	} else if id, ok := strings.CutPrefix(path, "/progress/"); ok {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}
		if id, ok = strings.CutSuffix(id, "/events"); ok {
			t, ok := i.prog.GetTicker(id)
			if !ok {
				return nil, "", errors.New("ticker not found")
			}
			return streamEvents(i, t.ListenEvents(), t.UnlistenEvents)
		} else if id, ok = strings.CutSuffix(id, "/output"); ok {
			t, ok := i.prog.GetTicker(id)
			if !ok {
				return nil, "", errors.New("ticker not found")
			}
			response = t.GetOutput()
		} else {
			data, err := i.GetProgress()
			if err != nil {
				return nil, "", err
			}
			return &byteHandler{b: data}, "text/json", nil
		}
	} else if id, ok := strings.CutPrefix(path, "/track/"); ok {
		if extUrl, ok := strings.CutPrefix(id, ":external/"); ok {
			if method == "POST" {
				success, err := i.DownloadExternalTrack(extUrl)
				if err != nil {
					return nil, "", err
				}
				response = success
			} else if method == "GET" {
				response, err = i.GetExternalTrackByURL(extUrl)
			} else {
				return nil, "", errors.New("method not allowed")
			}
		} else if method != "GET" {
			return nil, "", errors.New("method not allowed")
		} else if path, ok := strings.CutPrefix(id, ":by-path/"); ok {
			path, err = url.QueryUnescape(path)
			path = filepath.Clean(path)
			path = filepath.Join(i.config.DataPath, path)
			if err != nil {
				return nil, "", err
			}
			id, err = i.resolveTrackFromPath(path)
			if err != nil {
				if schema.AudioExts[strings.ToLower(filepath.Ext(path))] {
					track := schema.Track{
						Name: strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
						Path: path,
					}
					data, err := json.Marshal(track)
					if err != nil {
						return nil, "", err
					}
					return &byteHandler{b: data}, "text/json", nil
				}
				return nil, "", err
			} else {
				return &redirectHandler{path: "/track/" + id}, "text/json", nil
			}
		} else if id, ok = strings.CutSuffix(id, "/data"); ok {
			data, err := i.GetTrackData(id)
			if err != nil {
				return nil, "", err
			}
			return &byteHandler{b: data}, "application/octet-stream", nil
		} else if id, ok = strings.CutSuffix(id, "/cover"); ok {
			data, mimeType, err := i.GetTrackCover(id)
			if err != nil {
				return nil, "", err
			}
			if data == nil {
				data, err = base64.StdEncoding.DecodeString(CoverFallback)
				if err != nil {
					return nil, "", err
				}
				mimeType = CoverFallbackMimetype
			}
			return &byteHandler{b: data}, mimeType, nil
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
	} else if filePath, ok := strings.CutPrefix(path, "/file/"); ok {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		response, err = i.ReadFileInPath(filePath)
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
	return &byteHandler{b: data}, "text/json", nil
}
