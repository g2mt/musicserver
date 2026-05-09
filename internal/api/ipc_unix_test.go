//go:build unix && !android

package api

import (
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// testGenericIface implements GenericInterface for testing.
type testGenericIface struct {
	handleRequestFn func(req *Request) (handler, string, error)
}

func (t *testGenericIface) HandleRequest(req *Request) (handler, string, error) {
	return t.handleRequestFn(req)
}

func TestIPC_RoundTrip(t *testing.T) {
	tmpDir := t.TempDir()
	socketPath := filepath.Join(tmpDir, "test.sock")

	iface := &testGenericIface{
		handleRequestFn: func(req *Request) (handler, string, error) {
			if req.Path == "/ping" && req.Method == "GET" {
				data, _ := json.Marshal(map[string]string{"status": "ok"})
				return &byteHandler{b: data}, "text/json", nil
			}
			return nil, "", os.ErrNotExist
		},
	}

	server := NewIPCServer(iface)
	go func() {
		if err := server.Start(socketPath); err != nil {
			t.Errorf("IPCServer.Start failed: %v", err)
		}
	}()
	defer server.Stop()

	time.Sleep(100 * time.Millisecond)

	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		t.Fatalf("net.Dial failed: %v", err)
	}
	defer conn.Close()

	conn.SetReadDeadline(time.Now().Add(10 * time.Second))

	req := struct {
		Path   string `json:"path"`
		Method string `json:"method"`
	}{
		Path:   "/ping",
		Method: "GET",
	}
	data, _ := json.Marshal(req)
	data = append(data, '\n')
	if _, err := conn.Write(data); err != nil {
		t.Fatalf("conn.Write failed: %v", err)
	}

	resp, err := net.Dial("unix", socketPath)
	if err != nil {
		t.Fatalf("net.Dial failed for read: %v", err)
	}
	defer resp.Close()
	resp.SetReadDeadline(time.Now().Add(10 * time.Second))

	req2 := struct {
		Path   string `json:"path"`
		Method string `json:"method"`
	}{
		Path:   "/ping",
		Method: "GET",
	}
	data2, _ := json.Marshal(req2)
	data2 = append(data2, '\n')
	if _, err := resp.Write(data2); err != nil {
		t.Fatalf("resp.Write failed: %v", err)
	}

	buf := make([]byte, 4096)
	n, err := resp.Read(buf)
	if err != nil {
		t.Fatalf("resp.Read failed: %v", err)
	}

	var result map[string]string
	if err := json.Unmarshal(buf[:n], &result); err != nil {
		t.Fatalf("json.Unmarshal failed: %v\nBody: %s", err, string(buf[:n]))
	}
	if result["status"] != "ok" {
		t.Errorf("Expected status ok, got %q", result["status"])
	}
}

func TestIPC_ErrorResponse(t *testing.T) {
	tmpDir := t.TempDir()
	socketPath := filepath.Join(tmpDir, "test.sock")

	iface := &testGenericIface{
		handleRequestFn: func(req *Request) (handler, string, error) {
			return nil, "", os.ErrNotExist
		},
	}

	server := NewIPCServer(iface)
	go func() {
		if err := server.Start(socketPath); err != nil {
			t.Errorf("IPCServer.Start failed: %v", err)
		}
	}()
	defer server.Stop()

	time.Sleep(100 * time.Millisecond)

	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		t.Fatalf("net.Dial failed: %v", err)
	}
	defer conn.Close()
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))

	req := struct {
		Path   string `json:"path"`
		Method string `json:"method"`
	}{
		Path:   "/fail",
		Method: "GET",
	}
	data, _ := json.Marshal(req)
	data = append(data, '\n')
	if _, err := conn.Write(data); err != nil {
		t.Fatalf("conn.Write failed: %v", err)
	}

	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("conn.Read failed: %v", err)
	}

	var result struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(buf[:n], &result); err != nil {
		t.Fatalf("json.Unmarshal failed: %v\nBody: %s", err, string(buf[:n]))
	}
	if result.Error == "" {
		t.Error("Expected non-empty error message")
	}
}

func TestIPC_MultipleRequests(t *testing.T) {
	tmpDir := t.TempDir()
	socketPath := filepath.Join(tmpDir, "test.sock")

	callCount := 0
	iface := &testGenericIface{
		handleRequestFn: func(req *Request) (handler, string, error) {
			callCount++
			data, _ := json.Marshal(map[string]int{"count": callCount})
			return &byteHandler{b: data}, "text/json", nil
		},
	}

	server := NewIPCServer(iface)
	go func() {
		if err := server.Start(socketPath); err != nil {
			t.Errorf("IPCServer.Start failed: %v", err)
		}
	}()
	defer server.Stop()

	time.Sleep(100 * time.Millisecond)

	for i := 1; i <= 3; i++ {
		conn, err := net.Dial("unix", socketPath)
		if err != nil {
			t.Fatalf("net.Dial failed on request %d: %v", i, err)
		}
		conn.SetReadDeadline(time.Now().Add(10 * time.Second))

		req := struct {
			Path   string `json:"path"`
			Method string `json:"method"`
		}{
			Path:   "/count",
			Method: "GET",
		}
		data, _ := json.Marshal(req)
		data = append(data, '\n')
		if _, err := conn.Write(data); err != nil {
			t.Fatalf("conn.Write failed on request %d: %v", i, err)
		}

		buf := make([]byte, 4096)
		n, err := conn.Read(buf)
		if err != nil {
			t.Fatalf("conn.Read failed on request %d: %v", i, err)
		}
		conn.Close()

		var result map[string]int
		if err := json.Unmarshal(buf[:n], &result); err != nil {
			t.Fatalf("json.Unmarshal failed on request %d: %v\nBody: %s", i, err, string(buf[:n]))
		}
		if result["count"] != i {
			t.Errorf("Request %d: expected count %d, got %d", i, i, result["count"])
		}
	}
}
