//go:build android
// +build android

package main

import (
	"io"
	"musicserver/internal/api"
	"musicserver/internal/schema"
)

func NewInterface(cfg *schema.Config) (*api.Interface, error) {
	return api.NewInterface(cfg)
}

func HandleRequest(i *api.Interface, path string, method string, params map[string]string) (r io.Reader, contentType string, err error) {
	return i.HandleRequestByteStream(path, method, params)
}

func main() {}
