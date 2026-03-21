package api

import (
	"encoding/json"
	"net/http"
)

type HTTPRouter struct {
	iface Interface
}

func NewHTTPRouter(iface Interface) *HTTPRouter {
	return &HTTPRouter{iface: iface}
}

func (r *HTTPRouter) Serve(w http.ResponseWriter, req *http.Request) {
	path := req.URL.Path

	switch {
	case path == "/track":
		r.handleGetTracks(w, req)
	case path == "/album":
		r.handleGetAlbums(w, req)
	case len(path) > 7 && path[:7] == "/track/":
		id := path[7:]
		if len(id) > 5 && id[len(id)-5:] == "/data" {
			r.handleGetTrackData(w, req, id[:len(id)-5])
		} else {
			r.handleGetTrackById(w, req, id)
		}
	case len(path) > 7 && path[:7] == "/album/":
		name := path[7:]
		r.handleGetAlbum(w, req, name)
	default:
		http.NotFound(w, req)
	}
}

func (r *HTTPRouter) handleGetTracks(w http.ResponseWriter, req *http.Request) {
	tracks, err := r.iface.GetTracks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/json")
	json.NewEncoder(w).Encode(tracks)
}

func (r *HTTPRouter) handleGetTrackById(w http.ResponseWriter, req *http.Request, id string) {
	track, err := r.iface.GetTrackById(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/json")
	json.NewEncoder(w).Encode(track)
}

func (r *HTTPRouter) handleGetTrackData(w http.ResponseWriter, req *http.Request, id string) {
	data, err := r.iface.GetTrackData(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(data)
}

func (r *HTTPRouter) handleGetAlbums(w http.ResponseWriter, req *http.Request) {
	albums, err := r.iface.GetAlbums()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/json")
	json.NewEncoder(w).Encode(albums)
}

func (r *HTTPRouter) handleGetAlbum(w http.ResponseWriter, req *http.Request, name string) {
	album, err := r.iface.GetAlbumByName(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/json")
	json.NewEncoder(w).Encode(album)
}
