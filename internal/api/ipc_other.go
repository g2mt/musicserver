//go:build !unix

package api

import "errors"

const IPCUnsupported = "OS does not support unix sockets"

type IPCServer struct {
}

func NewIPCServer(iface *Interface) *IPCServer {
	return nil
}

func (s *IPCServer) Start(path string) error {
	return errors.New(IPCUnsupported)
}

func (iface *Interface) WriteToIPC(path, method string, params map[string]string) ([]byte, error) {
	return nil, errors.New(IPCUnsupported)
}
