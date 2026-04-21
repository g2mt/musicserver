package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log/slog"
)

const CoverCacheDbPath = "./cache.db"
const CoverCacheVersion = 2

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
			checksum TEXT NOT NULL,
			mime_type TEXT NOT NULL,
			timestamp INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS blobs (
			checksum TEXT PRIMARY KEY,
			data BLOB NOT NULL
		);
		CREATE TABLE IF NOT EXISTS stats (
			key TEXT PRIMARY KEY,
			value INTEGER NOT NULL
		);
		INSERT OR IGNORE INTO stats (key, value) VALUES ('version', ?);
		INSERT OR IGNORE INTO stats (key, value) VALUES ('size', 0);
	`, CoverCacheVersion)
	return err
}

func (i *Interface) CleanCoverCache() error {
	if i.ccacheDb == nil {
		return nil
	}

	_, err := i.ccacheDb.Exec(`
		DELETE FROM cover_cache;
		DELETE FROM blobs;
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

	err = ctx.QueryRow(`
		SELECT b.data, c.mime_type
		FROM cover_cache c
		JOIN blobs b ON c.checksum = b.checksum
		WHERE c.path = ?
	`, path).Scan(&cachedData, &mimeType)
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

func (i *Interface) insertCoverCacheEntry(cached coverCacheData) {
	path := cached.path
	data := cached.data
	dataLen := len(data)
	mimeType := cached.mimeType
	slog.Debug("Starting to cache image", "path", path, "dataLen", dataLen, "mimeType", mimeType)

	// Compute checksum
	hash := sha256.Sum256(data)
	checksum := hex.EncodeToString(hash[:])

	// Begin a transaction for caching
	tx, err := i.ccacheDb.Begin()
	if err != nil {
		slog.Warn("Unable to begin cache transaction", "path", path, "err", err)
		return
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Check if blob already exists
	var existing int
	err = tx.QueryRow("SELECT 1 FROM blobs WHERE checksum = ?", checksum).Scan(&existing)
	blobExists := false
	if err == nil {
		blobExists = true
	} else if err != sql.ErrNoRows {
		slog.Warn("Unable to check existing blob", "path", path, "err", err)
		return
	}

	// Evict old entries if cache is full (only if we need space for a new blob)
	if !blobExists {
		var currentSize int
		err = tx.QueryRow("SELECT value FROM stats WHERE key = 'size'").Scan(&currentSize)
		if err != nil {
			slog.Warn("Unable to retrieve size", "err", err)
			return
		}
		if currentSize+dataLen >= i.config.CacheDbMaxBytes {
			// Expire oldest entries first until we have enough space
			rows, qErr := tx.Query(`
				SELECT c.path, c.checksum, length(b.data)
				FROM cover_cache c
				JOIN blobs b ON c.checksum = b.checksum
				ORDER BY c.timestamp ASC
			`)
			defer rows.Close()
			if qErr != nil {
				slog.Warn("Unable to sort blobs by timestamp", "err", err)
				return
			}
			evicted := 0
			for rows.Next() && currentSize+dataLen >= i.config.CacheDbMaxBytes {
				var evictPath string
				var evictChecksum string
				var evictSize int
				if rows.Scan(&evictPath, &evictChecksum, &evictSize) == nil {
					_, err = tx.Exec("DELETE FROM cover_cache WHERE path = ?", evictPath)
					if err != nil {
						slog.Warn("Unable to delete cover_cache entry during eviction", "path", evictPath, "err", err)
						return
					}
					// Check if checksum is still referenced
					var refCount int
					err = tx.QueryRow("SELECT COUNT(*) FROM cover_cache WHERE checksum = ?", evictChecksum).Scan(&refCount)
					if err != nil {
						slog.Warn("Unable to check reference count during eviction", "checksum", evictChecksum, "err", err)
						return
					}
					if refCount == 0 {
						_, err = tx.Exec("DELETE FROM blobs WHERE checksum = ?", evictChecksum)
						if err != nil {
							slog.Warn("Unable to delete blob during eviction", "checksum", evictChecksum, "err", err)
							return
						}
						_, err = tx.Exec("UPDATE stats SET value = MAX(0, value - ?) WHERE key = 'size'", evictSize)
						if err != nil {
							slog.Warn("Unable to update cache size during eviction", "err", err)
							return
						}
						currentSize -= evictSize
					}
				}
				evicted += 1
			}
			slog.Debug("Evicted cache", "evicted", evicted)
		}
	}

	// Insert blob if it doesn't exist
	if !blobExists {
		_, err = tx.Exec("INSERT INTO blobs (checksum, data) VALUES (?, ?)", checksum, data)
		if err != nil {
			slog.Warn("Unable to insert blob", "path", path, "err", err)
			return
		}
		_, err = tx.Exec("UPDATE stats SET value = value + ? WHERE key = 'size'", dataLen)
		if err != nil {
			slog.Warn("Unable to update cache size", "path", path, "err", err)
			return
		}
	}

	_, err = tx.Exec(
		"INSERT OR REPLACE INTO cover_cache (path, checksum, mime_type, timestamp) VALUES (?, ?, ?, strftime('%s','now'))",
		path, checksum, mimeType,
	)
	if err != nil {
		slog.Warn("Unable to cache track", "path", path, "err", err)
		return
	}

	err = tx.Commit()
	if err != nil {
		slog.Warn("Unable to commit to cache", "err", err)
		return
	}
}
