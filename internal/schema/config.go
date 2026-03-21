package schema

type Config struct {
	// binds the HTTP API backend to this path
	HTTPBind string `yaml:"http_bind"`
	// binds the Unix socket API backend to this path. By default, binds to /run/musicserver/socket
	UnixBind string `yaml:"unix_bind"`
	// path where data is stored
	DataPath string `yaml:"data_path"`
}
