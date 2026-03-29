package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

type handler interface {
	io.Closer
	HandleHTTP(w http.ResponseWriter, req *http.Request) error
	HandleWriter(w io.Writer) error
}

type byteHandler struct{ b []byte }

func (h *byteHandler) Close() error {
	return nil
}

func (h *byteHandler) HandleHTTP(w http.ResponseWriter, req *http.Request) error {
	_, err := w.Write(h.b)
	return err
}

func (h *byteHandler) HandleWriter(w io.Writer) error {
	_, err := w.Write(h.b)
	return err
}

type eventStreamer[T any] struct {
	i        *Interface
	ch       chan T
	unlisten func(chan T)
}

func (s *eventStreamer[T]) HandleHTTP(w http.ResponseWriter, req *http.Request) error {
	if s.ch == nil {
		return errors.New("Streaming not supported")
	}

	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		return errors.New("Streaming not supported")
	}

	// Wait for next event from channel
	for {
		event, ok := <-s.ch
		if !ok {
			return nil
		}

		// Marshal event to JSON
		data, err := json.Marshal(event)
		if err != nil {
			return nil
		}

		// Format as SSE
		w.Write([]byte("event: data\n"))
		w.Write([]byte("data: " + string(data) + "\n\n"))
		flusher.Flush()
	}
}

func (s *eventStreamer[T]) HandleWriter(w io.Writer) error {
	if s.ch == nil {
		return errors.New("No new events")
	}

	// Wait for next event from channel
	event, ok := <-s.ch
	if !ok {
		return errors.New("No new events")
	}

	// Marshal event to JSON
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	// Format as SSE
	_, err = w.Write([]byte("event: data\n"))
	if err != nil {
		return err
	}
	_, err = w.Write([]byte("data: " + string(data) + "\n\n"))
	if err != nil {
		return err
	}
	return nil
}

func (s *eventStreamer[T]) Close() error {
	s.unlisten(s.ch)
	return nil
}

func streamEvents[T any](i *Interface, ch chan T, unlisten func(chan T)) (handler, string, error) {
	stream := &eventStreamer[T]{
		i:        i,
		ch:       ch,
		unlisten: unlisten,
	}
	return stream, "text/event-stream", nil
}

type redirectHandler struct {
	path string
}

func (r *redirectHandler) Close() error {
	return nil
}

func (r *redirectHandler) HandleHTTP(w http.ResponseWriter, req *http.Request) error {
	http.Redirect(w, req, r.path, http.StatusFound)
	return nil
}

func (r *redirectHandler) HandleWriter(w io.Writer) error {
	panic("redirectHandler called")
}
