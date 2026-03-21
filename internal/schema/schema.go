package schema

type Track struct {
	ID      string `json:"id"`
	ShortID string `json:"short_id"`
	Name    string `json:"name"`
	Path    string `json:"path"`
	Album   string `json:"album"`
}

type Album struct {
	Name   string   `json:"name"`
	Tracks []string `json:"tracks"`
}
