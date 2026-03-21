package api

import (
	"net/http"
)

type HTTPRouter struct {
	iface *Interface
}

func NewHTTPRouter(iface *Interface) *HTTPRouter {
	return &HTTPRouter{iface: iface}
}

func (r *HTTPRouter) Serve(w http.ResponseWriter, req *http.Request) {
	response, contentType, err := r.iface.handleRequest(req.URL.Path, req.Method)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", contentType)
	if contentType == "application/octet-stream" {
		w.Write(response)
	} else {
		w.Write(response)
	}
}
