package api

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"musicserver/internal/migration"
	"musicserver/internal/progress"
	"musicserver/internal/schema"
	"musicserver/internal/searchparser"

	"github.com/fsnotify/fsnotify"
	lru "github.com/hashicorp/golang-lru/v2"
)

var Version string

type Interface struct {
	db *sql.DB

	ccacheDb   *sql.DB // nullable
	ccacheChan chan<- coverCacheData

	config *schema.Config // readonly
	prog   *progress.Progress

	LongIdGen func(track *schema.Track) string

	scan struct {
		// mu is held during a full ScanTracks call, causing WatchDataDir to pause.
		mu     sync.Mutex
		ticker atomic.Pointer[progress.ProgressTicker] // may be nil
	}
	watcher *fsnotify.Watcher

	// thread-safe external track cache for downloads
	exTrackCache *lru.Cache[string, schema.Track]

	// dlExternal stores the state of ongoing external downloads
	dlExternal   map[string]dlExternal
	dlExternalMu sync.Mutex
}

const SqlDbPath = "./info.db"
const MaxIdLength = 64 // size of sha256 hash
const MinShortIdLength = 6
const MaxPageCount = 50 // default count
const MaxTrackCacheQueue = 16
const MaxExTrackCache = 16

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

	// sqlite dsn from: https://stackoverflow.com/a/79652616
	db, err := sql.Open("sqlite3", "file:"+dbDir+"?_journal_mode=WAL&_busy_timeout=3000&_synchronous=NORMAL&_txlock=deferred")
	if err != nil {
		return nil, err
	}

	var ccacheDb *sql.DB
	var ccacheChan chan coverCacheData
	if config.CacheDbEnabled != nil && *config.CacheDbEnabled {
		// Open cache database
		ccacheDbDir := filepath.Join(config.DbDir, CoverCacheDbPath)
		ccacheDb, err = sql.Open("sqlite3", ccacheDbDir)
		if err != nil {
			return nil, err
		}
		ccacheChan = make(chan coverCacheData, MaxTrackCacheQueue)
	}

	exTrackCache, _ := lru.New[string, schema.Track](MaxExTrackCache)

	i := &Interface{
		db:           db,
		ccacheDb:     ccacheDb,
		ccacheChan:   ccacheChan,
		config:       config,
		prog:         progress.NewProgress(),
		LongIdGen:    defaultLongIdGen,
		exTrackCache: exTrackCache,
	}
	if ccacheChan != nil {
		go i.runFlushCoverCache(ccacheChan)
	}
	return i, nil
}

func (i *Interface) InitDb() error {
	err := migration.Migrate(i.db)
	if err != nil {
		return err
	}

	// Initialize cache db if available
	if i.ccacheDb != nil {
		if err := i.initCacheDb(); err != nil {
			slog.Warn("Error initializing cache database, setting to nil", "err", err)
			i.ccacheDb = nil
		}
	}

	return nil
}

func (i *Interface) Close() error {
	if err := i.db.Close(); err != nil {
		return err
	}
	if i.ccacheDb != nil {
		if err := i.ccacheDb.Close(); err != nil {
			return err
		}
	}
	return nil
}

// tx may be nil
func (i *Interface) getQueryRow(tx *sql.Tx) interface {
	QueryRow(query string, args ...any) *sql.Row
} {
	if tx == nil {
		return i.db
	} else {
		return tx
	}
}

func (i *Interface) handleRequest(path string, method string, params map[string]string) (out handler, contentType string, err error) {
	var response interface{}

	if path == "/track" {
		if method == "GET" {
			var search *searchparser.Result
			limit := 0
			if limitParam, ok := params["limit"]; ok {
				limit, _ = strconv.Atoi(limitParam)
			}
			if searchParam, ok := params["q"]; ok {
				s := searchparser.Parse(searchParam)
				search = &s
			}
			response, err = i.GetTracks(search, limit)
		} else if method == "POST" {
			force := params["force"] == "true"
			response, err = i.ScanTracks(params["path"], force)
		} else if method == "DELETE" {
			success, err := i.ForgetAllTracks()
			if err != nil {
				return nil, "", err
			}
			response = success
		} else {
			return nil, "", errors.New("method not allowed")
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
			if err != nil {
				return nil, "", err
			}
			path = filepath.Clean(path)
			fullPath := filepath.Join(i.config.DataPath, path)

			id, err = i.resolveTrackFromPath(fullPath, nil)
			if err != nil {
				if schema.AudioExts[strings.ToLower(filepath.Ext(path))] {
					track := schema.Track{
						Name: strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
						Path: fullPath,
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
	} else if path == "/props" {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		response = i.GetProps()
	} else if path == "/album" {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		response, err = i.GetAlbums()
	} else if name, ok := strings.CutPrefix(path, "/album/"); ok {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		if pageStr, ok := strings.CutPrefix(path, ":by-page/"); ok && len(pageStr) > 0 {
			page, err := strconv.Atoi(pageStr)
			if err != nil {
				return nil, "", err
			}
			response, err = i.GetAlbumsByPage(page)
		} else {
			response, err = i.GetAlbumByName(name)
		}
	} else if path, ok := strings.CutPrefix(path, "/file/"); ok {
		if method != "GET" {
			return nil, "", errors.New("method not allowed")
		}

		path, err = url.QueryUnescape(path)
		if err != nil {
			return nil, "", err
		}
		fullPath := filepath.Join("/", path)
		if relPath, err := filepath.Rel(i.config.DataPath, fullPath); err != nil || relPath == ".." || strings.HasPrefix(relPath, "../") {
			return nil, "", errors.New("permission denied")
		}
		info, err := os.Stat(fullPath)
		if err != nil {
			return nil, "", err
		}
		if info.IsDir() {
			response, err = i.getFilesInPath(fullPath)
		} else {
			data, err := os.ReadFile(fullPath)
			if err != nil {
				return nil, "", err
			}
			return &byteHandler{b: data}, "application/octet-stream", nil
		}
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

func (i *Interface) HandleRequestByteStream(path string, method string, params map[string]string) (r io.Reader, contentType string, err error) {
	buf := &bytes.Buffer{}
	reader, contentType, err := i.handleRequest(path, method, params)
	if err != nil {
		return nil, "", err
	}
	for {
		if re, ok := reader.(*redirectHandler); ok {
			reader, contentType, err = i.handleRequest(re.path, method, params)
		} else {
			break
		}
	}
	if err != nil {
		return nil, "", err
	}
	reader.HandleWriter(buf)
	return buf, contentType, err
}
