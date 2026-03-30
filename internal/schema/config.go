package schema

import (
	"fmt"
	"os"
	"os/user"

	"github.com/goccy/go-yaml"
)

type Config struct {
	// binds the HTTP API backend to this path. defaults to localhost:8000
	HTTPBind string `json:"http_bind" yaml:"http_bind"`
	// If set, then enable the local unix socket
	UnixBindEnabled bool `json:"unix_bind_enabled" yaml:"unix_bind_enabled"`
	// binds the Unix socket API backend to this path. By default, binds to /run/musicserver/socket for root, ~/.musicserver/socket for non-root
	UnixBind string `json:"unix_bind" yaml:"unix_bind"`
	// path where music data is stored
	DataPath string `json:"data_path" yaml:"data_path"`
	// path where database and other info is stored. defaults to /var/lib/musicserver for root users, ~/.musicserver/db if non-root
	DbDir string `json:"db_dir" yaml:"db_dir"`
	// If set, enables the cache database. defaults to true
	CacheDbEnabled *bool `json:"cache_db_enabled" yaml:"cache_db_enabled"`
	// path to generic media downloader binary
	MediaDownloader string `json:"media_downloader" yaml:"media_downloader"`
}

func LoadConfig(path string) (*Config, error) {
	configData, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("error reading config file: %w", err)
	}

	var config Config
	err = yaml.Unmarshal(configData, &config)
	if err != nil {
		return nil, fmt.Errorf("error parsing config file: %w", err)
	}

	currentUser, err := user.Current()
	if err != nil {
		return nil, fmt.Errorf("error getting current user: %w", err)
	}

	// Set default values if not provided
	if config.HTTPBind == "" {
		config.HTTPBind = "localhost:8000"
	}

	// Only set default UnixBind if Unix socket is enabled
	if config.UnixBindEnabled && config.UnixBind == "" {
		if currentUser.Uid == "0" {
			config.UnixBind = "/run/musicserver/socket"
		} else {
			config.UnixBind = currentUser.HomeDir + "/.musicserver/socket"
		}
	}

	if config.DbDir == "" {
		if currentUser.Uid == "0" {
			config.DbDir = "/var/lib/musicserver"
		} else {
			config.DbDir = currentUser.HomeDir + "/.musicserver/db"
		}
	}

	if config.CacheDbEnabled == nil {
		defaultVal := true
		config.CacheDbEnabled = &defaultVal
	}

	return &config, nil
}
