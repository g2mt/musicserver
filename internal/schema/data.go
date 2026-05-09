package schema

type Track struct {
	LongID        string `json:"id"`
	ShortID       string `json:"short_id"`
	Name          string `json:"name"`
	Path          string `json:"path"`           // path relative to the config DataPath
	Artist        string `json:"artist"`
	Album         string `json:"album"`
	ThumbnailPath string `json:"thumbnail_path,omitempty"` // path relative to the config DataPath
}

type Album struct {
	Name   string   `json:"name"`
	Tracks []string `json:"tracks"` // long IDs of all tracks
}
