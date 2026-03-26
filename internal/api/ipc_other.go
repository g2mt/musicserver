//go:build !unix
// +build !unix

package api

import "errors"

type UnixSocketServer struct {
}

func NewUnixSocketServer(iface *Interface) *UnixSocketServer {
	return nil
}

func (s *UnixSocketServer) Start(path string) error {
	return errors.New("OS does not support unix sockets")
}
