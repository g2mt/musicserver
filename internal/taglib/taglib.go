package taglib

// #cgo pkg-config: taglib
// #include "bindings.h"
// #include <stdlib.h>
import "C"
import (
	"musicserver/internal/schema"
	"unsafe"
)

// LoadTrack loads track metadata from the given file path using taglib.
// Returns a Track struct with the extracted metadata.
func LoadTrack(path string) (schema.Track, error) {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))

	var cTrack C.TrackMetadata
	result := C.load_track_metadata(cPath, &cTrack)
	defer C.free_track_metadata(&cTrack)

	if result != 0 {
		// Return empty track and error
		return schema.Track{}, newTaglibError(result)
	}

	// Convert C struct to Go struct
	track := schema.Track{
		LongID:  "",
		ShortID: "",
		Name:    C.GoString(cTrack.title),
		Path:    path,
		Album:   C.GoString(cTrack.album),
	}

	return track, nil
}

// taglibError represents an error from the taglib library
type taglibError struct {
	code int
}

func newTaglibError(code C.int) error {
	return &taglibError{code: int(code)}
}

func (e *taglibError) Error() string {
	switch e.code {
	case 1:
		return "taglib: file not found"
	case 2:
		return "taglib: unable to read file"
	case 3:
		return "taglib: unsupported file format"
	default:
		return "taglib: unknown error"
	}
}
