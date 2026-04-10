//go:build android

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

typedef struct MsrvReadAllResult {
	char *Data;
	int N;
	char *Err;
} MsrvReadAllResult;

typedef struct MsrvScanTickerValuesResult {
	int Present;
	int Value;
	int MaxValue;
} MsrvScanTickerValuesResult;

typedef struct MsrvLoadTrackByPathResult {
	char *ShortId;
	char *Err;
} MsrvLoadTrackByPathResult;

typedef struct MsrvGetTrackFileChecksumInfoResult {
	int64_t CkLastModified;
	int64_t CkSize;
	char *Err;
} MsrvGetTrackFileChecksumInfoResult;

typedef struct MsrvGetAllTrackPathsResult {
	char **Paths;
	int N;
	char *Err;
} MsrvGetAllTrackPathsResult;
*/
import "C"

import (
	"encoding/json"
	"io"
	"musicserver/internal/api"
	"musicserver/internal/schema"
	"musicserver/internal/taglib"
	"runtime/cgo"
	"unsafe"

	_ "github.com/mattn/go-sqlite3"
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

	err = iface.InitDb()
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
func MsrvHandleRequest(ifaceHandle C.uintptr_t, path *C.char, method *C.char, paramsJson *C.char) C.struct_MsrvHandleRequestResult {
	iface := cgo.Handle(ifaceHandle).Value().(*api.Interface)

	// Parse the JSON-encoded params map
	var params map[string]string
	err := json.Unmarshal([]byte(C.GoString(paramsJson)), &params)
	if err != nil {
		return C.struct_MsrvHandleRequestResult{
			ReaderHandle: 0,
			ContentType:  nil,
			Err:          C.CString(err.Error()),
		}
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

// MsrvReadAll reads all bytes from the reader identified by readerHandle.
//
//export MsrvReadAll
func MsrvReadAll(readerHandle C.uintptr_t) C.struct_MsrvReadAllResult {
	reader := cgo.Handle(readerHandle).Value().(io.Reader)

	data, err := io.ReadAll(reader)
	if err != nil {
		return C.struct_MsrvReadAllResult{Data: nil, N: 0, Err: C.CString(err.Error())}
	}

	cData := C.CBytes(data)
	return C.struct_MsrvReadAllResult{Data: (*C.char)(cData), N: C.int(len(data)), Err: nil}
}

// MsrvGetTrackFileChecksumInfo gets the checksum info for a track from the database.
//
//export MsrvGetTrackFileChecksumInfo
func MsrvGetTrackFileChecksumInfo(ifaceHandle C.uintptr_t, path *C.char) C.struct_MsrvGetTrackFileChecksumInfoResult {
	iface := cgo.Handle(ifaceHandle).Value().(*api.Interface)

	ckLastModified, ckSize, err := iface.GetTrackFileChecksumInfo(C.GoString(path))
	if err != nil {
		return C.struct_MsrvGetTrackFileChecksumInfoResult{CkLastModified: 0, CkSize: 0, Err: C.CString(err.Error())}
	}

	return C.struct_MsrvGetTrackFileChecksumInfoResult{
		CkLastModified: C.int64_t(ckLastModified),
		CkSize:         C.int64_t(ckSize),
		Err:            nil,
	}
}

// MsrvLoadTrackByPath loads a track from the given path and adds it to the interface.
//
//export MsrvLoadTrackByPath
func MsrvLoadTrackByPath(ifaceHandle C.uintptr_t, path *C.char) C.struct_MsrvLoadTrackByPathResult {
	iface := cgo.Handle(ifaceHandle).Value().(*api.Interface)

	track, err := taglib.LoadTrack(C.GoString(path))
	if err != nil {
		return C.struct_MsrvLoadTrackByPathResult{ShortId: nil, Err: C.CString(err.Error())}
	}

	shortId, err := iface.AddTrack(&track)
	if err != nil {
		return C.struct_MsrvLoadTrackByPathResult{ShortId: nil, Err: C.CString(err.Error())}
	}

	return C.struct_MsrvLoadTrackByPathResult{ShortId: C.CString(shortId), Err: nil}
}

//export MsrvGetAllTrackPaths
func MsrvGetAllTrackPaths(ifaceHandle C.uintptr_t) C.struct_MsrvGetAllTrackPathsResult {
	iface := cgo.Handle(ifaceHandle).Value().(*api.Interface)

	paths, err := iface.GetAllTrackPaths()
	if err != nil {
		return C.struct_MsrvGetAllTrackPathsResult{Paths: nil, N: 0, Err: C.CString(err.Error())}
	}

	n := len(paths)
	cPaths := C.malloc(C.size_t(n) * C.size_t(unsafe.Sizeof((*C.char)(nil))))
	pSlice := unsafe.Slice((**C.char)(cPaths), n)

	for i, p := range paths {
		pSlice[i] = C.CString(p)
	}

	return C.struct_MsrvGetAllTrackPathsResult{
		Paths: (**C.char)(cPaths),
		N:     C.int(n),
		Err:   nil,
	}
}

//export MsrvForgetTrackByPath
func MsrvForgetTrackByPath(ifaceHandle C.uintptr_t, path *C.char) *C.char {
	iface := cgo.Handle(ifaceHandle).Value().(*api.Interface)

	err := iface.ForgetTrackByPath(C.GoString(path))
	if err != nil {
		return C.CString(err.Error())
	}

	return nil
}

type byteReader struct {
	data   []byte
	offset int
}

func (r *byteReader) Read(p []byte) (int, error) {
	if r.offset >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.offset:])
	r.offset += n
	return n, nil
}

// MsrvDeleteHandle frees a cgo.Handle when C code is done with it.
//
//export MsrvDeleteHandle
func MsrvDeleteHandle(handle C.uintptr_t) {
	cgo.Handle(handle).Delete()
}

func main() {}
