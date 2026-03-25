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

func (i *Interface) ScanTracks() (map[string]string, error) {
	i.scanMu.Lock()
	defer i.scanMu.Unlock()

	slog.Debug("full scan started")

	// First, count total files for progress tracking
	totalFiles := int32(0)
	err := filepath.WalkDir(i.config.DataPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			totalFiles++
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Bind progress ticker
	ticker, err := i.prog.Bind("scanTracks")
	if err != nil {
		return nil, err
	}
	defer i.prog.Unbind("scanTracks")
	ticker.SetMaxValue(totalFiles)

	added := make(map[string]string)
	err = filepath.WalkDir(i.config.DataPath, func(path string, d os.DirEntry, err error) error {
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

		// Add track to database (ignore duplicate errors)
		shortID, err := i.AddTrack(&track)
		if err != nil {
			return nil
		}

		// Successfully added, record in result map
		added[shortID] = track.Name

		// Update progress
		ticker.AddValue(1)
		return nil
	})

	if err != nil {
		return nil, err
	}

	return added, nil
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
			if locked := i.scanMu.TryLock(); !locked {
				slog.Debug("WatchDataDir paused, waiting for full scan to complete")
				i.scanMu.Lock()
				i.scanMu.Unlock()

				slog.Debug("skipping current WatchDataDir iteration")
				time.Sleep(WatchDirInterval)
				continue eventLoop
			} else {
				i.scanMu.Unlock()
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
			slog.Debug("WatchDataDir processing written path", "path", absPath)
			track, err := taglib.LoadTrack(absPath)
			if err != nil {
				continue
			}
			i.AddTrack(&track)
			ticker.AddValue(1)
		}

		// Process deleted paths
		for path := range deletedPaths {
			slog.Debug("WatchDataDir processing deleted path", "path", path)
			if err := i.ForgetTrackByPath(path); err != nil {
				return err
			}
			ticker.AddValue(1)
		}

		time.Sleep(WatchDirInterval)
	}
}
