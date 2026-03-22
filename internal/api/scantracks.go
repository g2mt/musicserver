package api

import (
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"musicserver/internal/taglib"

	"github.com/fsnotify/fsnotify"
)

const WatchDirInterval = 10 * time.Second

func (i *Interface) ScanTracks() (map[string]string, error) {
	i.scanMu.Lock()
	defer i.scanMu.Unlock()
	slog.Debug("full scan started")
	added := make(map[string]string)

	err := filepath.WalkDir(i.config.DataPath, func(path string, d os.DirEntry, err error) error {
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
		return nil
	})

	if err != nil {
		return nil, err
	}

	return added, nil
}

func (i *Interface) WatchDataDir() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer watcher.Close()

	if err := watcher.Add(i.config.DataPath); err != nil {
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
			case event, ok := <-watcher.Events:
				if !ok {
					return nil
				}
				switch {
				case event.Has(fsnotify.Create) || event.Has(fsnotify.Write) || event.Has(fsnotify.Rename):
					writtenPaths[event.Name] = struct{}{}
				case event.Has(fsnotify.Remove):
					deletedPaths[event.Name] = struct{}{}
				}
			case <-watcher.Errors:
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
		}

		// Process deleted paths
		for path := range deletedPaths {
			slog.Debug("WatchDataDir processing deleted path", "path", path)
			if err := i.removeTrackByPath(path); err != nil {
				return err
			}
		}

		time.Sleep(WatchDirInterval)
	}
}
