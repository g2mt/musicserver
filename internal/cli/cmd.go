package cli

import (
	"io/fs"

	"musicserver/internal/api"
	"musicserver/internal/schema"
)

type Context struct {
	CLI        *CLI
	Config     *schema.Config
	IFace      *api.Interface
	EmbeddedFS fs.FS
}

type Cmd interface {
	Exec(ctx *Context) error
}
