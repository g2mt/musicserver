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
	Title     string `json:"title"`
	Uploader  string `json:"uploader"`
	Album     string `json:"album"`
	Thumbnail string `json:"thumbnail"`
}

func (i *Interface) GetExternalTrackByURL(u string) (schema.Track, error) {
	if i.config.MediaDownloader == "" {
		return schema.Track{}, errors.New("no media downloader configured")
	}

	// Check cache first
	if track, ok := i.exTrackCache.Get(u); ok {
		return track, nil
	}

	out, err := exec.Command(i.config.MediaDownloader, "--dump-single-json", u).Output()
	if err != nil {
		return schema.Track{}, err
	}

	var info dlInfo
	if err := json.Unmarshal(out, &info); err != nil {
		return schema.Track{}, err
	}

	track := schema.Track{
		Name:          info.Title,
		Artist:        info.Uploader,
		Album:         info.Album,
		Path:          u,
		ThumbnailPath: info.Thumbnail,
	}

	// Add to cache
	i.exTrackCache.Add(u, track)

	return track, nil
}

func (i *Interface) DownloadExternalTrack(url string) (string, error) {
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
	// cmd := exec.Command(i.config.MediaDownloader, url)
	cmd := exec.Command(i.config.MediaDownloader, "about:blank")
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
