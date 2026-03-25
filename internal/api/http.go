package api

import (
	"encoding/json"
	"io"
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

	response, contentType, err := r.iface.handleRequest(req.URL.Path, req.Method, params)
	if err != nil {
		data, _ := json.Marshal(struct {
			Error string `json:"error"`
		}{Error: err.Error()})
		http.Error(w, string(data), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", contentType)
	io.Copy(w, response)
}
