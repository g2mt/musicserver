package api

import (
	"encoding/json"
	"errors"
	"os/exec"

	"musicserver/internal/schema"
)

type dlInfo struct {
	Title    string `json:"title"`
	Uploader string `json:"uploader"`
	Album    string `json:"album"`
	Filename string `json:"filename"`
}

func (i *Interface) GetExternalTrackByURL(u string) (schema.Track, error) {
	if i.config.MediaDownloader == "" {
		return schema.Track{}, errors.New("no media downloader configured")
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
		Name:   info.Title,
		Artist: info.Uploader,
		Album:  info.Album,
		Path:   info.Filename,
	}

	return track, nil
}
