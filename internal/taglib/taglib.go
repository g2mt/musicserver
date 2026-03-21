package taglib

// #cgo pkg-config: taglib
// #include "bindings.h"
// #include <stdlib.h>
import "C"
import (
	"musicserver/internal/schema"
	"unsafe"
)

// taglibError represents an error from the taglib library
type taglibError struct {
	msg string
}

func newTaglibError(errMsg *C.char) error {
	if errMsg == nil {
		return nil
	}
	return &taglibError{msg: C.GoString(errMsg)}
}

func (e *taglibError) Error() string {
	return "taglib: " + e.msg
}

// LoadTrack loads track metadata from the given file path using taglib.
// Returns a Track struct with the extracted metadata.
func LoadTrack(path string) (schema.Track, error) {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))

	var cTrack C.TrackMetadata
	result := C.load_track_metadata(cPath, &cTrack)
	defer C.free_track_metadata(&cTrack)

	if err := newTaglibError(result.err); err != nil {
		// Return empty track and error
		return schema.Track{}, err
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

// ExtractCoverArt extracts embedded cover art from the audio file at path.
// Returns nil data (and no error) if the file has no cover art.
func ExtractCoverArt(path string) ([]byte, string, error) {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))

	var cArt C.CoverArt
	result := C.extract_cover_art(cPath, &cArt)
	defer C.free_cover_art(&cArt)

	if err := newTaglibError(result.err); err != nil {
		return nil, "", err
	}

	if cArt.data == nil || cArt.data_length == 0 {
		return nil, "", nil
	}

	data := C.GoBytes(unsafe.Pointer(cArt.data), cArt.data_length)
	mimeType := C.GoString(cArt.mime_type)
	return data, mimeType, nil
}
