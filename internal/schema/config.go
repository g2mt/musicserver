package schema

type Config struct {
	// binds the HTTP API backend to this path
	HTTPBind string `yaml:"http_bind"`
	// binds the Unix socket API backend to this path. By default, binds to /run/musicserver/socket
	UnixBind string `yaml:"unix_bind"`
	// path where music data is stored
	DataPath string `yaml:"data_path"`
	// path where database and other info is stored. defaults to /var/lib/musicserver for root users, ~/.var/lib/musicserver if non-root
	DbPath string `yaml:"data_path"`
}

const SQL_DB_PATH = "./config.db"

func LoadConfig(path string) (*Config, error) {}
