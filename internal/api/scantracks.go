//go:build !android
// +build !android

package api

import (
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"musicserver/internal/taglib"

	"github.com/fsnotify/fsnotify"
)

const WatchDirInterval = 1 * time.Second

func (i *Interface) ScanTracks(path string) (addedFiles int, err error) {
	i.scan.mu.Lock()
	defer i.scan.mu.Unlock()

	slog.Debug("full scan started", "path", path)

	// Determine base path
	basePath := i.config.DataPath
	if path != "" {
		basePath = filepath.Join(basePath, path)
	}

	// Bind progress ticker
	if ticker, err := i.prog.Bind("scanTracks"); err == nil {
		if i.scan.ticker.Swap(ticker) != nil {
			panic("Expected old ticker to be nil")
		}
	} else {
		return 0, err
	}
	defer func() {
		if i.scan.ticker.Swap(nil) == nil {
			panic("Expected old ticker to not be nil")
		}
		i.prog.Unbind("scanTracks")
	}()

	// Count total files for progress tracking
	totalFiles := int32(0)
	err = filepath.WalkDir(basePath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			totalFiles++
			i.scan.ticker.Load().AddMaxValue(1)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	// Scan all files
	err = filepath.WalkDir(basePath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		path, err = filepath.Abs(path)
		if err != nil {
			return err
		}

		track, err := taglib.LoadTrack(path)
		if err != nil {
			return nil
		}

		_, err = i.AddTrack(&track)
		if err != nil {
			return nil
		}

		addedFiles += 1
		i.scan.ticker.Load().AddValue(1)
		return nil
	})

	if err != nil {
		return 0, err
	}
	return addedFiles, nil
}

func (i *Interface) WatchDataDir() error {
	var err error
	if i.watcher != nil {
		panic("WatchDataDir started twice")
	}
	i.watcher, err = fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer func() { i.watcher.Close(); i.watcher = nil }()

	ticker, err := i.prog.Bind("watchData")
	if err != nil {
		return err
	}
	defer i.prog.Unbind("watchData")

	if err := i.watcher.Add(i.config.DataPath); err != nil {
		return err
	}

eventLoop:
	for {
		// Collect events for up to 1 second
		writtenPaths := make(map[string]struct{})
		deletedPaths := make(map[string]struct{})

		deadline := time.After(1 * time.Second)
	collectLoop:
		for {

			// If ScanTracks is running, discard collected events and wait for it to finish.
			if locked := i.scan.mu.TryLock(); !locked {
				slog.Debug("WatchDataDir paused, waiting for full scan to complete")
				i.scan.mu.Lock()
				i.scan.mu.Unlock()

				slog.Debug("skipping current WatchDataDir iteration")
				time.Sleep(WatchDirInterval)
				continue eventLoop
			} else {
				i.scan.mu.Unlock()
			}

			select {
			case event, ok := <-i.watcher.Events:
				if !ok {
					return nil
				}
				switch {
				case event.Has(fsnotify.Create) || event.Has(fsnotify.Write) || event.Has(fsnotify.Rename):
					writtenPaths[event.Name] = struct{}{}
					ticker.AddMaxValue(1)
				case event.Has(fsnotify.Remove):
					deletedPaths[event.Name] = struct{}{}
					ticker.AddMaxValue(1)
				}
			case <-i.watcher.Errors:
				// ignore watcher errors
			case <-deadline:
				break collectLoop
			}
		}

		// Process written paths
		for path := range writtenPaths {
			absPath, err := filepath.Abs(path)
			if err != nil {
				continue
			}
			info, err := os.Stat(absPath)
			if err != nil {
				continue
			}
			if info.IsDir() {
				err = filepath.WalkDir(absPath, func(path string, d os.DirEntry, err error) error {
					if err != nil {
						return err
					}
					if d.IsDir() {
						return nil
					}
					slog.Info("WatchDataDir processing written path", "path", path)
					track, err := taglib.LoadTrack(path)
					if err != nil {
						return nil
					}
					i.AddTrack(&track)
					ticker.AddValue(1)
					return nil
				})
				if err != nil {
					slog.Error("WatchDataDir error walking directory", "path", absPath, "error", err)
				}
			} else {
				slog.Info("WatchDataDir processing written path", "path", absPath)
				track, err := taglib.LoadTrack(absPath)
				if err != nil {
					continue
				}
				i.AddTrack(&track)
				ticker.AddValue(1)
			}
		}

		// Process deleted paths
		for path := range deletedPaths {
			slog.Info("WatchDataDir processing deleted path", "path", path)
			if err := i.ForgetTrackByPath(path); err != nil {
				slog.Error("Failed to forget path", "err", err)
				continue
			}
			ticker.AddValue(1)
		}

		time.Sleep(WatchDirInterval)
	}
}
