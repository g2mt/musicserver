package api

import (
	"fmt"
	"log/slog"
)

const CoverCacheDbPath = "./cache.db"
const CoverCacheMaxBytes = 512 * 1024 * 1024 // 512 Mb
const CoverCacheVersion = 1

type coverCacheData struct {
	path     string
	data     []byte
	mimeType string
}

func (i *Interface) initCacheDb() error {
	// Check version before running initialization
	var currentVersion int
	err := i.ccacheDb.QueryRow("SELECT value FROM stats WHERE key = 'version'").Scan(&currentVersion)
	if err == nil {
		if currentVersion != CoverCacheVersion {
			return fmt.Errorf("cache database version mismatch: expected %d, found %d", CoverCacheVersion, currentVersion)
		}
	}

	_, err = i.ccacheDb.Exec(`
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
		INSERT OR IGNORE INTO stats (key, value) VALUES ('version', ?);
	`, CoverCacheVersion)
	return err
}

func (i *Interface) CleanCoverCache() error {
	if i.ccacheDb == nil {
		return nil
	}

	_, err := i.ccacheDb.Exec(`
		DELETE FROM cover_cache;
		INSERT OR REPLACE INTO stats (key, value) VALUES ('size', 0);
	`)
	return err
}

func (i *Interface) getTrackCoverCached(path string) ([]byte, string, error) {
	if i.ccacheDb == nil {
		return nil, "", nil
	}
	ctx, err := i.ccacheDb.Begin()
	if err != nil {
		return nil, "", err
	}
	defer func() {
		if err != nil {
			ctx.Rollback()
		} else {
			ctx.Commit()
		}
	}()
	var cachedData []byte
	var mimeType string

	err = ctx.QueryRow("SELECT data, mime_type FROM cover_cache WHERE path = ?", path).Scan(&cachedData, &mimeType)
	if err != nil {
		return nil, "", nil // skip not found errors
	}

	// Update timestamp on cache hit
	_, err = ctx.Exec("UPDATE cover_cache SET timestamp = strftime('%s','now') WHERE path = ?", path)
	if err != nil {
		return nil, "", err
	}
	return cachedData, mimeType, nil
}

func (i *Interface) runFlushCoverCache(cacheChan <-chan coverCacheData) {
	for cached := range cacheChan {
		func() {
			path := cached.path
			data := cached.data
			dataLen := len(data)
			mimeType := cached.mimeType
			// slog.Debug("Starting to cache image", "path", path, "dataLen", dataLen, "mimeType", mimeType)

			// Begin a transaction for caching
			tx, err := i.ccacheDb.Begin()
			if err != nil {
				slog.Warn("Unable to begin cache transaction", "path", path, "err", err)
			}
			defer func() {
				if err != nil {
					tx.Rollback()
				}
			}()

			// Evict old entries if cache is full
			var currentSize int
			err = tx.QueryRow("SELECT value FROM stats WHERE key = 'size'").Scan(&currentSize)
			if err == nil && currentSize+dataLen >= CoverCacheMaxBytes {
				// Expire oldest entries first until we have enough space
				rows, qErr := tx.Query("SELECT path, length(data) FROM cover_cache ORDER BY timestamp ASC")
				if qErr == nil {
					defer rows.Close()
					for rows.Next() && currentSize+dataLen >= CoverCacheMaxBytes {
						var evictPath string
						var evictSize int
						if rows.Scan(&evictPath, &evictSize) == nil {
							_, err = tx.Exec("DELETE FROM cover_cache WHERE path = ?", evictPath)
							if err != nil {
								return
							}
							_, err = tx.Exec("UPDATE stats SET value = MAX(0, value - ?) WHERE key = 'size'", evictSize)
							if err != nil {
								return
							}
							currentSize -= evictSize
						}
					}
				}
			}

			_, err = tx.Exec(
				"INSERT OR REPLACE INTO cover_cache (path, data, mime_type, timestamp) VALUES (?, ?, ?, strftime('%s','now'))",
				path, data, mimeType,
			)
			if err != nil {
				slog.Warn("Unable to cache track", "path", path, "err", err)
				return
			}

			_, err = tx.Exec("UPDATE stats SET value = value + ? WHERE key = 'size'", dataLen)
			if err != nil {
				slog.Warn("Unable to update cache size", "path", path, "err", err)
				return
			}

			err = tx.Commit()
			if err != nil {
				slog.Warn("Unable to commit to cache", "err", err)
				return
			}
		}()
	}
}
