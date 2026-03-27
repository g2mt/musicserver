package api

import (
	"bufio"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
)

type HTTPRouter struct {
	iface *Interface
}

func NewHTTPRouter(iface *Interface) *HTTPRouter {
	return &HTTPRouter{iface: iface}
}

func (r *HTTPRouter) Serve(w http.ResponseWriter, req *http.Request) {
	// Extract query parameters into a map
	var params map[string]string
	query := req.URL.Query()
	if len(query) > 0 {
		params = make(map[string]string)
		for key, values := range query {
			if len(values) > 0 {
				params[key] = values[0]
			}
		}
	}

	reader, contentType, err := r.iface.handleRequest(req.URL.Path, req.Method, params)
	for {
		if re, ok := reader.(*redirectHandler); ok {
			reader, contentType, err = r.iface.handleRequest(re.path, re.method, re.params)
		} else {
			break
		}
	}

	if err != nil {
		data, _ := json.Marshal(struct {
			Error string `json:"error"`
		}{Error: err.Error()})
		http.Error(w, string(data), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", contentType)
	reader.HandleHTTP(w, req)
}
