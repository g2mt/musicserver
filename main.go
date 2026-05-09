//go:build !android

package main

import (
	"embed"
	"log/slog"
	"os"
	"path/filepath"

	"musicserver/internal/api"
	"musicserver/internal/cli"
	"musicserver/internal/schema"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed frontend/dist
var embeddedFrontend embed.FS

func main() {
	var c cli.CLI
	cmd := c.Parse()

	// Set up logging based on flags
	level := slog.LevelInfo
	if c.Debug {
		level = slog.LevelDebug
	} else {
		switch c.Loglevel {
		case "debug":
			level = slog.LevelDebug
		case "warn":
			level = slog.LevelWarn
		case "error":
			level = slog.LevelError
		}
	}
	slog.SetLogLoggerLevel(level)

	configPath := c.Config
	if configPath == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			configPath = filepath.Join(home, ".config", "musicserver.yaml")
		}
	}
	config, err := schema.LoadConfig(configPath)
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

	cmd.Exec(&cli.Context{
		CLI:        &c,
		Config:     config,
		IFace:      iface,
		EmbeddedFS: embeddedFrontend,
	})
}
