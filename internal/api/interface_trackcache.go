package api

import (
	"log/slog"
)

type trackCacheData struct {
	path     string
	data     []byte
	mimeType string
}

func (i *Interface) runFlushTrackCache(cacheChan <-chan trackCacheData) {
	for cached := range cacheChan {
		func() {
			path := cached.path
			data := cached.data
			dataLen := len(data)
			mimeType := cached.mimeType

			// Begin a transaction for caching
			tx, err := i.cacheDb.Begin()
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
			if err == nil && currentSize+dataLen >= CacheMaxBytes {
				// Expire oldest entries first until we have enough space
				rows, qErr := tx.Query("SELECT path, length(data) FROM cover_cache ORDER BY timestamp ASC")
				if qErr == nil {
					defer rows.Close()
					for rows.Next() && currentSize+dataLen >= CacheMaxBytes {
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
			tx.Commit()
		}()
	}
}
