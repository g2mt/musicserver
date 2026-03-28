//go:build android
// +build android

package main

/*
#include <stdlib.h>
#include <stdint.h>

typedef struct MsrvConfig {
	char *HTTPBind;
	int UnixBindEnabled;
	char *UnixBind;
	char *DataPath;
	char *DbDir;
	char *MediaDownloader;
} MsrvConfig;

typedef struct MsrvNewInterfaceResult {
	uintptr_t Handle;
	char *Err;
} MsrvNewInterfaceResult;

typedef struct MsrvHandleRequestResult {
	uintptr_t ReaderHandle;
	char *ContentType;
	char *Err;
} MsrvHandleRequestResult;

typedef struct MsrvReadResult {
	char *Data;
	int N;
	char *Err;
} MsrvReadResult;
*/
import "C"

import (
	"encoding/json"
	"musicserver/internal/api"
	"musicserver/internal/schema"
	"runtime/cgo"
	"unsafe"
)

//export MsrvIdentify
func MsrvIdentify() *C.char {
	return C.CString("musicserver")
}

//export MsrvNewInterfaceFromConfigJson
func MsrvNewInterfaceFromConfigJson(configJson *C.char) C.struct_MsrvNewInterfaceResult {
	var goCfg schema.Config
	err := json.Unmarshal([]byte(C.GoString(configJson)), &goCfg)
	if err != nil {
		return C.struct_MsrvNewInterfaceResult{
			Handle: 0,
			Err:    C.CString(err.Error()),
		}
	}

	iface, err := api.NewInterface(&goCfg)
	if err != nil {
		return C.struct_MsrvNewInterfaceResult{
			Handle: 0,
			Err:    C.CString(err.Error()),
		}
	}

	handle := cgo.NewHandle(iface)
	return C.struct_MsrvNewInterfaceResult{
		Handle: C.uintptr_t(handle),
		Err:    nil,
	}
}

//export MsrvHandleRequest
func MsrvHandleRequest(ifaceHandle C.uintptr_t, path *C.char, method *C.char, keys **C.char, values **C.char, paramsLen C.int) C.struct_MsrvHandleRequestResult {
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
		return C.struct_MsrvHandleRequestResult{
			ReaderHandle: 0,
			ContentType:  nil,
			Err:          C.CString(err.Error()),
		}
	}

	readerHandle := cgo.NewHandle(reader)
	return C.struct_MsrvHandleRequestResult{
		ReaderHandle: C.uintptr_t(readerHandle),
		ContentType:  C.CString(contentType),
		Err:          nil,
	}
}

// MsrvRead reads up to bufLen bytes from the reader identified by readerHandle into buf.
// Returns MsrvReadResult with N=-1 on EOF, N=-2 on error.
//
//export MsrvRead
func MsrvRead(readerHandle C.uintptr_t, buf *C.char, bufLen C.int) C.struct_MsrvReadResult {
	reader := cgo.Handle(readerHandle).Value().(interface{ Read([]byte) (int, error) })

	goSlice := unsafe.Slice((*byte)(unsafe.Pointer(buf)), int(bufLen))
	n, err := reader.Read(goSlice)
	if err != nil {
		if err.Error() == "EOF" {
			return C.struct_MsrvReadResult{Data: buf, N: -1, Err: nil}
		}
		return C.struct_MsrvReadResult{Data: buf, N: -2, Err: C.CString(err.Error())}
	}

	return C.struct_MsrvReadResult{Data: buf, N: C.int(n), Err: nil}
}

// MsrvDeleteHandle frees a cgo.Handle when C code is done with it.
//
//export MsrvDeleteHandle
func MsrvDeleteHandle(handle C.uintptr_t) {
	cgo.Handle(handle).Delete()
}

func main() {}
