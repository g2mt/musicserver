package api

import (
	"encoding/json"
	"net"
	"os"
	"os/signal"
	"syscall"
)

type UnixSocketServer struct {
	iface  Interface
	socket net.Listener
	done   chan struct{}
}

func NewUnixSocketServer(iface Interface) *UnixSocketServer {
	return &UnixSocketServer{
		iface: iface,
		done:  make(chan struct{}),
	}
}

func (s *UnixSocketServer) Start(path string) error {
	if err := os.RemoveAll(path); err != nil {
		return err
	}

	listener, err := net.Listen("unix", path)
	if err != nil {
		return err
	}
	s.socket = listener

	if err := os.Chmod(path, 0777); err != nil {
		return err
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		s.Stop()
	}()

	for {
		select {
		case <-s.done:
			return nil
		default:
		}

		conn, err := listener.Accept()
		if err != nil {
			select {
			case <-s.done:
				return nil
			default:
				continue
			}
		}

		go s.handleConnection(conn)
	}
}

func (s *UnixSocketServer) Stop() error {
	close(s.done)
	if s.socket != nil {
		return s.socket.Close()
	}
	return nil
}

func (s *UnixSocketServer) handleConnection(conn net.Conn) {
	defer conn.Close()

	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil {
		return
	}

	var req struct {
		Path   string `json:"path"`
		Method string `json:"method"`
	}
	if err := json.Unmarshal(buf[:n], &req); err != nil {
		return
	}

	response, _, err := s.iface.handleRequest(req.Path, req.Method)
	if err != nil {
		response, _ = json.Marshal(struct {
			Error string `json:"error"`
		}{Error: err.Error()})
		conn.Write(response)
		return
	}

	conn.Write(response)
}
