package main

import (
	"embed"
	"flag"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"musicserver/internal/api"
	"musicserver/internal/schema"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed frontend/dist
var embeddedFrontend embed.FS

func main() {
	configPath := flag.String("config", "", "path to config file")
	debug := flag.Bool("debug", false, "enable debug mode")
	loglevel := flag.String("loglevel", "info", "log level (debug, info, warn, error)")
	flag.Parse()

	// Set up logging based on flags
	level := slog.LevelInfo
	if *debug {
		level = slog.LevelDebug
	} else if *loglevel != "" {
		switch *loglevel {
		case "debug":
			level = slog.LevelDebug
		case "warn":
			level = slog.LevelWarn
		case "error":
			level = slog.LevelError
		}
	}
	slog.SetLogLoggerLevel(level)

	if *configPath == "" {
		slog.Error("Error: -config flag is required")
		flag.Usage()
		os.Exit(1)
	}

	config, err := schema.LoadConfig(*configPath)
	if err != nil {
		slog.Error("Error loading config", "err", err)
		os.Exit(1)

	}

	// Create API interface and initialize database
	iface, err := api.NewInterface(config)
	if err != nil {
		slog.Error("Error open database", "err", err)
		os.Exit(1)
	}
	defer iface.Close()

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

	// Bind http server to http_bind
	httpRouter := api.NewHTTPRouter(iface)
	http.Handle("/api/", http.StripPrefix("/api", http.HandlerFunc(httpRouter.Serve)))

	if *debug {
		// Mount frontend from filesystem in debug mode
		execPath, err := os.Executable()
		if err != nil {
			slog.Error("Error getting executable path", "err", err)
			os.Exit(1)
		}
		frontendDir := filepath.Join(filepath.Dir(execPath), "frontend", "dist")
		slog.Debug("Serving frontend from filesystem", "path", frontendDir)
		http.Handle("/", http.FileServer(http.Dir(frontendDir)))
	} else {
		// Serve embedded frontend in production
		slog.Info("Serving embedded frontend")
		sub, err := fs.Sub(embeddedFrontend, "frontend/dist")
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

	if config.UnixBindEnabled {
		// Bind unix socket in another socket
		unixServer := api.NewUnixSocketServer(iface)
		if unixServer == nil {
			slog.Warn("OS does not support unix sockets, not starting socket server")
		} else {
			// Ensure the socket directory exists
			socketDir := filepath.Dir(config.UnixBind)
			if err := os.MkdirAll(socketDir, 0755); err != nil {
				slog.Error("Error creating Unix socket directory", "err", err)
				os.Exit(1)
			}

			slog.Info("Starting Unix socket server", "bind", config.UnixBind)
			if err := unixServer.Start(config.UnixBind); err != nil {
				slog.Error("Unix socket server error", "err", err)
				os.Exit(1)
			}
			return
		}
	}

	// Wait indefinitely if only HTTP server is running
	select {}
}
