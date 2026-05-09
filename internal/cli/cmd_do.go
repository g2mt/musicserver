package cli

import (
	"fmt"
	"log/slog"
	"os"
)

type DoCmd struct {
	Path   string            `kong:"arg,help='path for ipc call'"`
	Method string            `kong:"arg,help='method for ipc call'"`
	Params map[string]string `kong:"arg,optional,help='params for ipc call'"`
}

func (d *DoCmd) Exec(ctx *Context) error {
	result, err := ctx.IFace.WriteToIPC(d.Path, d.Method, d.Params)
	if err != nil {
		slog.Error("WriteToIPC error", "err", err)
		os.Exit(1)
	}
	fmt.Println(string(result))
	return nil
}
