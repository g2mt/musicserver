//go:build unix
// +build unix

package api

import (
	"bufio"
	"encoding/json"
	"io"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type UnixSocketServer struct {
	iface  *Interface
	socket net.Listener
	done   chan struct{}
}

func NewUnixSocketServer(iface *Interface) *UnixSocketServer {
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

	// Set a read timeout of 1 minute
	conn.SetReadDeadline(time.Now().Add(time.Minute))

	reader := bufio.NewReader(conn)
	for {
		// Read until newline
		line, err := reader.ReadBytes('\n')
		if err != nil {
			// Timeout or other error, stop reading
			return
		}

		var req struct {
			Path   string            `json:"path"`
			Method string            `json:"method"`
			Params map[string]string `json:"params,omitempty"`
		}
		if err := json.Unmarshal(line, &req); err != nil {
			// Invalid JSON, skip this line
			continue
		}

		reader, _, err := s.iface.handleRequest(req.Path, req.Method, req.Params)
		if err != nil {
			data, _ := json.Marshal(struct {
				Error string `json:"error"`
			}{Error: err.Error()})
			conn.Write(data)
			continue
		}

		if data, ok := reader.([]byte); ok {
			conn.Write(data)
		} else if reader, ok := reader.(io.ReadCloser); ok {
			scanner := bufio.NewScanner(reader)
			for scanner.Scan() {
				conn.Write(scanner.Bytes())
				conn.Write([]byte{'\n'})
			}
			if err := scanner.Err(); err != nil {
				data, _ := json.Marshal(struct {
					Error string `json:"error"`
				}{Error: err.Error()})
				conn.Write(data)
			}
		}

	}
}
