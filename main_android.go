//go:build android
// +build android

package main

// #include <stdlib.h>
import "C"

import (
	"musicserver/internal/api"
	"musicserver/internal/schema"
	"runtime/cgo"
	"unsafe"
)

// MsrvConfig is a C-compatible representation of schema.Config
type MsrvConfig struct {
	HTTPBind        *C.char
	UnixBindEnabled C.int
	UnixBind        *C.char
	DataPath        *C.char
	DbDir           *C.char
	MediaDownloader *C.char
}

// MsrvNewInterfaceResult holds the result of MsrvNewInterface
type MsrvNewInterfaceResult struct {
	Handle C.uintptr_t
	Err    *C.char
}

// MsrvHandleRequestResult holds the result of MsrvHandleRequest
type MsrvHandleRequestResult struct {
	ReaderHandle C.uintptr_t
	ContentType  *C.char
	Err          *C.char
}

// MsrvReadResult holds the result of a MsrvRead call
type MsrvReadResult struct {
	Data *C.char
	N    C.int
	Err  *C.char
}

//export MsrvNewInterface
func MsrvNewInterface(cfg MsrvConfig) MsrvNewInterfaceResult {
	goCfg := &schema.Config{
		HTTPBind:        C.GoString(cfg.HTTPBind),
		UnixBindEnabled: cfg.UnixBindEnabled != 0,
		UnixBind:        C.GoString(cfg.UnixBind),
		DataPath:        C.GoString(cfg.DataPath),
		DbDir:           C.GoString(cfg.DbDir),
		MediaDownloader: C.GoString(cfg.MediaDownloader),
	}

	iface, err := api.NewInterface(goCfg)
	if err != nil {
		return MsrvNewInterfaceResult{
			Handle: 0,
			Err:    C.CString(err.Error()),
		}
	}

	handle := cgo.NewHandle(iface)
	return MsrvNewInterfaceResult{
		Handle: C.uintptr_t(handle),
		Err:    nil,
	}
}

//export MsrvHandleRequest
func MsrvHandleRequest(ifaceHandle C.uintptr_t, path *C.char, method *C.char, keys **C.char, values **C.char, paramsLen C.int) MsrvHandleRequestResult {
	iface := cgo.Handle(ifaceHandle).Value().(*api.Interface)

	// Reconstruct the params map from parallel C string arrays
	params := make(map[string]string, int(paramsLen))
	keySlice := unsafe.Slice(keys, int(paramsLen))
	valSlice := unsafe.Slice(values, int(paramsLen))
	for idx := 0; idx < int(paramsLen); idx++ {
		params[C.GoString(keySlice[idx])] = C.GoString(valSlice[idx])
	}

	reader, contentType, err := iface.HandleRequestByteStream(C.GoString(path), C.GoString(method), params)
	if err != nil {
		return MsrvHandleRequestResult{
			ReaderHandle: 0,
			ContentType:  nil,
			Err:          C.CString(err.Error()),
		}
	}

	readerHandle := cgo.NewHandle(reader)
	return MsrvHandleRequestResult{
		ReaderHandle: C.uintptr_t(readerHandle),
		ContentType:  C.CString(contentType),
		Err:          nil,
	}
}

// MsrvRead reads up to bufLen bytes from the reader identified by readerHandle into buf.
// Returns MsrvReadResult with N=-1 on EOF, N=-2 on error.
//
//export MsrvRead
func MsrvRead(readerHandle C.uintptr_t, buf *C.char, bufLen C.int) MsrvReadResult {
	reader := cgo.Handle(readerHandle).Value().(interface{ Read([]byte) (int, error) })

	goSlice := unsafe.Slice((*byte)(unsafe.Pointer(buf)), int(bufLen))
	n, err := reader.Read(goSlice)
	if err != nil {
		if err.Error() == "EOF" {
			return MsrvReadResult{Data: buf, N: -1, Err: nil}
		}
		return MsrvReadResult{Data: buf, N: -2, Err: C.CString(err.Error())}
	}

	return MsrvReadResult{Data: buf, N: C.int(n), Err: nil}
}

// MsrvDeleteHandle frees a cgo.Handle when C code is done with it.
//
//export MsrvDeleteHandle
func MsrvDeleteHandle(handle C.uintptr_t) {
	cgo.Handle(handle).Delete()
}

func main() {}
