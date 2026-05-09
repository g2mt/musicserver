//go:build !android

package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"musicserver/internal/api"
	"musicserver/internal/schema"

	"github.com/alecthomas/kong"
	_ "github.com/mattn/go-sqlite3"
)

//go:embed frontend/dist
var embeddedFrontend embed.FS

type CLI struct {
	Config   string `kong:"optional,help='path to config file',default=''"`
	Debug    bool   `kong:"short='d',help='enable debug mode'"`
	Loglevel string `kong:"default='info',help='log level (debug, info, warn, error)'"`

	Serve ServeCmd `kong:"cmd,help='serve the server',default='1'"`
	Do    DoCmd    `kong:"cmd,help='do an ipc call'"`
}

type ServeCmd struct {
	DebugExternal bool   `kong:"help='enable debug mode for external tracks'"`
	FrontendDir   string `kong:"help='custom frontend directory path (debug mode only)'"`
}

func (s *ServeCmd) cmdServe(config *schema.Config, iface *api.Interface, cli *CLI) {
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

		if cli.Debug {
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
			return
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

type DoCmd struct {
	Path   string            `kong:"optional,help='path for ipc call'"`
	Method string            `kong:"arg,help='method for ipc call'"`
	Params map[string]string `kong:"arg,optional,help='params for ipc call'"`
}

func (d *DoCmd) cmdDo(config *schema.Config, iface *api.Interface) {
	path := d.Path
	if path == "" {
		path = config.IPCBind
	}
	result, err := iface.WriteToIPC(path, d.Method, d.Params)
	if err != nil {
		slog.Error("WriteToIPC error", "err", err)
		os.Exit(1)
	}
	fmt.Println(string(result))
}

func main() {
	var cli CLI
	ctx := kong.Parse(&cli)

	// Set up logging based on flags
	level := slog.LevelInfo
	if cli.Debug {
		level = slog.LevelDebug
	} else {
		switch cli.Loglevel {
		case "debug":
			level = slog.LevelDebug
		case "warn":
			level = slog.LevelWarn
		case "error":
			level = slog.LevelError
		}
	}
	slog.SetLogLoggerLevel(level)

	configPath := cli.Config
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

	switch ctx.Command() {
	case "do <method>":
		cli.Do.cmdDo(config, iface)
	default:
		cli.Serve.cmdServe(config, iface, &cli)
	}
}
