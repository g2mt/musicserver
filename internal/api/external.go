package api

import (
	"encoding/json"
	"errors"
	"os/exec"

	"github.com/hashicorp/golang-lru/v2"
	"musicserver/internal/schema"
)

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
