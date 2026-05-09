package cli

import (
	"github.com/alecthomas/kong"
)

type CLI struct {
	Config   string `kong:"optional,help='path to config file',default=''"`
	Debug    bool   `kong:"short='d',help='enable debug mode'"`
	Loglevel string `kong:"default='info',help='log level (debug, info, warn, error)'"`

	Serve ServeCmd `kong:"cmd,help='serve the server',default='1'"`
	Do    DoCmd    `kong:"cmd,help='do an ipc call'"`
}

func (c *CLI) Parse() Cmd {
	kctx := kong.Parse(c)
	switch kctx.Command() {
	case "do <path> <method>":
		fallthrough
	case "do <path> <method> <params>":
		return &c.Do
	default:
		return &c.Serve
	}
}
