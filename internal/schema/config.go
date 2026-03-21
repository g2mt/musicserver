package schema

import (
	"fmt"
	"os"
	"os/user"

	"github.com/goccy/go-yaml"
)

type Config struct {
	// binds the HTTP API backend to this path
	HTTPBind string `yaml:"http_bind"`
	// If explicitly set, then enable or disable the local unix socket. Otherwise, defaults to true
	UnixBindEnabled *bool `yaml:"unix_bind_enabled"`
	// binds the Unix socket API backend to this path. By default, binds to /run/musicserver/socket for root, ~/.musicserver/socket for non-root
	UnixBind string `yaml:"unix_bind"`
	// path where music data is stored
	DataPath string `yaml:"data_path"`
	// path where database and other info is stored. defaults to /var/lib/musicserver for root users, ~/.var/lib/musicserver if non-root
	DbPath string `yaml:"data_path"`
}

const SQL_DB_PATH = "./config.db"

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
	if config.UnixBindEnabled == nil {
		// Default to true if not explicitly set
		defaultEnabled := true
		config.UnixBindEnabled = &defaultEnabled
	}

	// Only set default UnixBind if Unix socket is enabled
	if *config.UnixBindEnabled && config.UnixBind == "" {
		if currentUser.Uid == "0" {
			config.UnixBind = "/run/musicserver/socket"
		} else {
			homeDir := currentUser.HomeDir
			config.UnixBind = homeDir + "/.musicserver/socket"
		}
	}

	if config.DbPath == "" {
		if currentUser.Uid == "0" {
			config.DbPath = "/var/lib/musicserver"
		} else {
			homeDir := currentUser.HomeDir
			config.DbPath = homeDir + "/.var/lib/musicserver"
		}
	}

	return &config, nil
}
