//go:build android
// +build android

package main

// #include <stdlib.h>
import "C"

import (
	"io"
	"musicserver/internal/api"
	"musicserver/internal/schema"
)

//export MsrvNewInterface
func NewInterface(cfg *schema.Config) (*api.Interface, error) {
	return api.NewInterface(cfg)
}

//export MsrvHandleRequest
func HandleRequest(i *api.Interface, path string, method string, params map[string]string) (r io.Reader, contentType string, err error) {
	return i.HandleRequestByteStream(path, method, params)
}

func main() {}
