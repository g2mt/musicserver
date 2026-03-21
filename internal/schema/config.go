package schema

type Config struct {
	// binds the HTTP API backend to this path
	HTTPBind string
	// binds the Unix socket API backend to this path. By default, binds to /run/musicserver/socket
	UnixBind string
	// path where data is stored
	DataPath string
}
