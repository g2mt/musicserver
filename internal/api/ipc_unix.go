//go:build unix && !android

package api

import (
	"bufio"
	"encoding/json"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type IPCServer struct {
	iface  GenericInterface
	socket net.Listener
	done   chan struct{}
}

func NewIPCServer(iface GenericInterface) *IPCServer {
	return &IPCServer{
		iface: iface,
		done:  make(chan struct{}),
	}
}

func (s *IPCServer) Start(path string) error {
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

func (s *IPCServer) Stop() error {
	close(s.done)
	if s.socket != nil {
		return s.socket.Close()
	}
	return nil
}

func (s *IPCServer) handleConnection(conn net.Conn) {
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(time.Minute))

	reader := bufio.NewReader(conn)
	for {
		// Read until newline
		line, err := reader.ReadBytes('\n')
		if err != nil {
			slog.Error("Error reading IPC", "err", err)
			return
		}

		var jsonReq struct {
			Path   string            `json:"path"`
			Method string            `json:"method"`
			Params map[string]string `json:"params,omitempty"`
		}
		if err := json.Unmarshal(line, &jsonReq); err != nil {
			// Invalid JSON, skip this line
			continue
		}
		slog.Debug("Received IPC request", "request", jsonReq)

		req := &Request{
			Path:    jsonReq.Path,
			Method:  jsonReq.Method,
			Params:  jsonReq.Params,
			FromIPC: true,
		}
		reader, _, err := s.iface.HandleRequest(req)
		for {
			if redirected, ok := reader.(*redirectHandler); ok {
				req.Path = redirected.path
				reader, _, err = s.iface.HandleRequest(req)
			} else {
				break
			}
		}

		if err != nil {
			data, _ := json.Marshal(struct {
				Error string `json:"error"`
			}{Error: err.Error()})
			conn.Write(data)
			conn.Write([]byte{0})
			continue
		}

		reader.HandleWriter(conn)
		conn.Write([]byte{0})
	}
}

func (iface *Interface) WriteToIPC(path, method string, params map[string]string) ([]byte, error) {
	// Connect to the unix socket
	conn, err := net.Dial("unix", iface.config.IPCBind)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(time.Minute))

	// Create the request
	req := struct {
		Path   string            `json:"path"`
		Method string            `json:"method"`
		Params map[string]string `json:"params,omitempty"`
	}{
		Path:   path,
		Method: method,
		Params: params,
	}

	// Marshal to JSON and add newline
	data, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	data = append(data, '\n')

	// Write the request
	slog.Debug("Preparing to write", "data", data)
	n := 0
	if n, err = conn.Write(data); err != nil {
		return nil, err
	}
	slog.Debug("Wrote to IPC", "n", n)

	// Read all response until socket closes
	slog.Debug("Preparing to read")
	reader := bufio.NewReader(conn)
	response, err := reader.ReadBytes(byte(0))
	if err != nil {
		return nil, err
	}
	response = response[:len(response)-1]

	return response, nil
}
