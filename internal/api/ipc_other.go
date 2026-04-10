//go:build !unix

package api

import "errors"

const UnixSocketUnsupported = "OS does not support unix sockets"

type UnixSocketServer struct {
}

func NewUnixSocketServer(iface *Interface) *UnixSocketServer {
	return nil
}

func (s *UnixSocketServer) Start(path string) error {
	return errors.New(UnixSocketUnsupported)
}

func (iface *Interface) WriteToUnixSocket(path, method string, params map[string]string) ([]byte, error) {
	return nil, errors.New(UnixSocketUnsupported)
}
