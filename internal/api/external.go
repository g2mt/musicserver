package api

import (
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
	if track, ok := i.trackCache.Get(u); ok {
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
	i.trackCache.Add(u, track)

	return track, nil
}

func (i *Interface) DownloadExternalTrack(url string) (bool, error) {
	i.dlExternalMu.Lock()
	defer i.dlExternalMu.Unlock()

	// Check if already downloading
	if i.dlExternal == nil {
		i.dlExternal = make(map[string]dlExternal)
	}
	if _, exists := i.dlExternal[url]; exists {
		return true, nil
	}

	// Create a new ticker for this download
	ticker, err := i.prog.Bind(url)
	if err != nil {
		return false, err
	}

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
		delete(i.dlExternal, url)
		i.prog.Unbind(url)
		return false, err
	}

	if err := cmd.Start(); err != nil {
		delete(i.dlExternal, url)
		i.prog.Unbind(url)
		return false, err
	}

	// Read stdout and add to ticker
	buf := make([]byte, 1024)
	for {
		n, err := stdout.Read(buf)
		if n > 0 {
			ticker.AddOutput(string(buf[:n]))
		}
		if err != nil {
			break
		}
	}
	cmd.Wait()

	// Cleanup
	i.dlExternalMu.Lock()
	delete(i.dlExternal, url)
	i.prog.Unbind(url)
	i.dlExternalMu.Unlock()

	return true, nil
}
