package cli

import (
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"musicserver/internal/api"
)

type ServeCmd struct {
	DebugExternal bool   `kong:"help='enable debug mode for external tracks'"`
	FrontendDir   string `kong:"help='custom frontend directory path (debug mode only)'"`
}

func (s *ServeCmd) Exec(ctx *Context) error {
	config := ctx.Config
	iface := ctx.IFace

	if s.DebugExternal {
		config.DebugExternal = true
	}

	// Initialize database
	if err := iface.InitDb(); err != nil {
		slog.Error("Error initializing database", "err", err)
		os.Exit(1)
	}

	go func() {
		if err := iface.WatchDataDir(); err != nil {
			slog.Error("WatchDataDir error", "err", err)
			os.Exit(1)
		}
	}()

	started := false

	if config.HTTPBindEnabled {
		// Bind http server to http_bind
		httpRouter := api.NewHTTPRouter(iface)
		http.Handle("/api/", http.StripPrefix("/api", http.HandlerFunc(httpRouter.Serve)))

		if ctx.CLI.Debug {
			// Mount frontend from filesystem in debug mode
			workingPath, err := os.Getwd()
			if err != nil {
				slog.Error("Error getting working directory", "err", err)
				os.Exit(1)
			}
			frontendDir := s.FrontendDir
			if frontendDir == "" {
				frontendDir = filepath.Join(workingPath, "frontend", "dist")
			}
			if info, err := os.Stat(frontendDir); err != nil || !info.IsDir() {
				slog.Error("Expected path to be a directory", "path", frontendDir)
				os.Exit(1)
			}
			slog.Debug("Serving frontend from filesystem", "path", frontendDir)
			http.Handle("/", http.FileServer(http.Dir(frontendDir)))
		} else {
			// Serve embedded frontend in production
			slog.Info("Serving embedded frontend")
			sub, err := fs.Sub(ctx.EmbeddedFS, "frontend/dist")
			if err != nil {
				panic(err)
			}
			http.Handle("/", http.FileServer(http.FS(sub)))
		}

		go func() {
			slog.Info("Starting HTTP server", "bind", config.HTTPBind)
			if err := http.ListenAndServe(config.HTTPBind, nil); err != nil {
				slog.Error("HTTP server error", "err", err)
				os.Exit(1)
			}
		}()

		started = true
	}

	if config.IPCBindEnabled {
		// Bind IPC socket
		unixServer := api.NewIPCServer(iface)
		if unixServer == nil {
			slog.Warn("OS does not support IPC sockets, not starting socket server")
		} else {
			// Ensure the socket directory exists
			socketDir := filepath.Dir(config.IPCBind)
			if err := os.MkdirAll(socketDir, 0755); err != nil {
				slog.Error("Error creating IPC socket directory", "err", err)
				os.Exit(1)
			}

			slog.Info("Starting IPC server", "bind", config.IPCBind)
			if err := unixServer.Start(config.IPCBind); err != nil {
				slog.Error("IPC server error", "err", err)
				os.Exit(1)
			}
			return nil
		}
		started = true
	}

	if !started {
		slog.Error("No servers started")
		os.Exit(1)
	}

	// Wait indefinitely for other threads
	select {}
}
