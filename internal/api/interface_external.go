package api

import (
	"bufio"
	"encoding/json"
	"errors"
	"os/exec"

	"musicserver/internal/progress"
	"musicserver/internal/schema"
)

type dlExternal struct {
	ticker *progress.ProgressTicker
	done   chan struct{}
}

type dlInfo struct {
	Title     string   `json:"title"`
	Uploader  string   `json:"uploader"`
	Album     string   `json:"album"`
	Thumbnail string   `json:"thumbnail"`
	Entries   []dlInfo `json:"entries"`
}

func (i *Interface) GetExternalTrackByURL(u string) ([]schema.Track, error) {
	if i.config.DebugExternal {
		if u == "http://track" {
			return []schema.Track{{Name: "Debug Track", Artist: "Debug Artist", Album: "Debug Album", Path: u}}, nil
		} else if u == "http://album" {
			return []schema.Track{
				{Name: "Track 1", Artist: "Debug Artist", Album: "Debug Album", Path: u + "/1"},
				{Name: "Track 2", Artist: "Debug Artist", Album: "Debug Album", Path: u + "/2"},
				{Name: "Track 3", Artist: "Debug Artist", Album: "Debug Album", Path: u + "/3"},
			}, nil
		} else {
			return nil, errors.New("incorrect debug url")
		}
	}

	if i.config.MediaDownloader == "" {
		return nil, errors.New("no media downloader configured")
	}

	// Check cache first
	if track, ok := i.exTrackCache.Get(u); ok {
		return []schema.Track{track}, nil
	}

	out, err := exec.Command(i.config.MediaDownloader, "--dump-single-json", u).Output()
	if err != nil {
		return nil, err
	}

	var info dlInfo
	if err := json.Unmarshal(out, &info); err != nil {
		return nil, err
	}

	var tracks []schema.Track
	if len(info.Entries) > 0 {
		for _, entry := range info.Entries {
			track := schema.Track{
				Name:          entry.Title,
				Artist:        entry.Uploader,
				Album:         entry.Album,
				Path:          u,
				ThumbnailPath: entry.Thumbnail,
			}
			tracks = append(tracks, track)
			i.exTrackCache.Add(u, track)
		}
	} else {
		track := schema.Track{
			Name:          info.Title,
			Artist:        info.Uploader,
			Album:         info.Album,
			Path:          u,
			ThumbnailPath: info.Thumbnail,
		}
		tracks = append(tracks, track)
		i.exTrackCache.Add(u, track)
	}

	return tracks, nil
}

func (i *Interface) DownloadExternalTrack(url string) (string, error) {
	if i.config.DebugExternal {
		return "", nil
	}

	if i.config.MediaDownloader == "" {
		return "", errors.New("no media downloader configured")
	}

	i.dlExternalMu.Lock()
	defer i.dlExternalMu.Unlock()

	// Check if already downloading
	if i.dlExternal == nil {
		i.dlExternal = make(map[string]dlExternal)
	}
	if _, exists := i.dlExternal[url]; exists {
		return "", nil
	}
	defer func() {
		i.dlExternalMu.Lock()
		delete(i.dlExternal, url)
		i.dlExternalMu.Unlock()
	}()

	// Create a new ticker for this download
	tickerName := "dl:" + url
	ticker, err := i.prog.Bind(tickerName)
	if err != nil {
		return "", err
	}
	defer func() {
		i.prog.Unbind(tickerName)
	}()

	// Store in map
	i.dlExternal[url] = struct {
		ticker *progress.ProgressTicker
		done   chan struct{}
	}{ticker: ticker, done: make(chan struct{})}

	// Spawn the command
	cmd := exec.Command(i.config.MediaDownloader, url)
	cmd.Dir = i.config.DataPath
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			ticker.AddOutput(scanner.Text())
		}
	}()

	if err := cmd.Start(); err != nil {
		return "", err
	}

	cmd.Wait()
	return ticker.GetOutput(), nil
}
