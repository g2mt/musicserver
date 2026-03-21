package main

import (
	"database/sql"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"musicserver/internal/api"
	"musicserver/internal/schema"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	configPath := flag.String("config", "", "path to config file")
	flag.Parse()

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

	// Open sql database in db_path/${SQL_DB_PATH}
	dbDir := filepath.Join(config.DbDir, schema.SQL_DB_PATH)

	// Ensure the directory exists
	if err := os.MkdirAll(config.DbDir, 0755); err != nil {
		slog.Error("Error creating database directory", "err", err)
		os.Exit(1)
	}

	db, err := sql.Open("sqlite3", dbDir)
	if err != nil {
		slog.Error("Error opening database", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	// Create API interface and initialize database
	iface := api.NewInterface(db, config)
	if err := iface.InitDb(); err != nil {
		slog.Error("Error initializing database", "err", err)
		os.Exit(1)
	}

	// Bind http server to http_bind
	httpRouter := api.NewHTTPRouter(iface)
	http.HandleFunc("/", httpRouter.Serve)

	go func() {
		slog.Info("Starting HTTP server", "bind", config.HTTPBind)
		if err := http.ListenAndServe(config.HTTPBind, nil); err != nil {
			slog.Error("HTTP server error", "err", err)
			os.Exit(1)
		}
	}()

	if *config.UnixBindEnabled {
		// Bind unix socket in another socket
		unixServer := api.NewUnixSocketServer(iface)

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
	} else {
		// Wait indefinitely if only HTTP server is running
		select {}
	}
}
