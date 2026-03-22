package api

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
	"musicserver/internal/taglib"
)

func (i *Interface) ScanTracks() (map[string]string, error) {
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

	for {
		// Collect events for up to 1 second
		writtenPaths := make(map[string]struct{})
		deletedPaths := make(map[string]struct{})

		deadline := time.After(1 * time.Second)
	collectLoop:
		for {
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
			track, err := taglib.LoadTrack(absPath)
			if err != nil {
				continue
			}
			i.AddTrack(&track)
		}

		// Process deleted paths
		for path := range deletedPaths {
			fmt.Println("deleted:", path)
		}

		time.Sleep(10 * time.Second)
	}
}
