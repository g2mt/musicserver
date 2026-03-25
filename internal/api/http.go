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
	if err != nil {
		data, _ := json.Marshal(struct {
			Error string `json:"error"`
		}{Error: err.Error()})
		http.Error(w, string(data), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", contentType)
	if data, ok := reader.([]byte); ok {
		w.Write(data)
	} else if reader, ok := reader.(io.ReadCloser); ok {
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "{error:\"Streaming not supported\"}", http.StatusInternalServerError)
		}

		scanner := bufio.NewScanner(reader)
		for scanner.Scan() {
			w.Write(scanner.Bytes())
			w.Write([]byte{'\n'})
			flusher.Flush()
		}
		if err := scanner.Err(); err != nil {
			slog.Error(err.Error())
			data, _ := json.Marshal(struct {
				Error string `json:"error"`
			}{Error: err.Error()})
			w.Write(data)
		}
	}
}
