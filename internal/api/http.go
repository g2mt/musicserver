package api

import (
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

	response, contentType, err := r.iface.handleRequest(path)
	if err != nil {
		// Determine appropriate status code based on error
		// For simplicity, we'll use 404 for "not found" errors
		// and 500 for other errors
		if err.Error() == "track not found" || err.Error() == "album not found" {
			http.Error(w, err.Error(), http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", contentType)
	if contentType == "application/octet-stream" {
		w.Write(response)
	} else {
		w.Write(response)
	}
}
