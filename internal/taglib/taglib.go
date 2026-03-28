package taglib

// #cgo CFLAGS: -I./taglib/.pkg/include
// #cgo LDFLAGS: -L./taglib/.pkg/lib -ltag
// #include "bindings.h"
// #include <stdlib.h>
import "C"
import (
	"musicserver/internal/schema"
	"os"
	"path/filepath"
	"strings"
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
		Artist:  C.GoString(cTrack.artist),
		Album:   C.GoString(cTrack.album),
	}

	return track, nil
}

// ExtractCoverArt extracts embedded cover art from the audio file at path.
// If no embedded cover art exists, falls back to searching for an image file
// in the parent directory (.png, .jpg, .webp).
// Returns nil data (and no error) if the file has no cover art.
func ExtractCoverArt(path string) (data []byte, mimeType string, _ error) {
	cPath := C.CString(path)
	defer C.free(unsafe.Pointer(cPath))

	var cArt C.CoverArt
	result := C.extract_cover_art(cPath, &cArt)
	defer C.free_cover_art(&cArt)

	if err := newTaglibError(result.err); err != nil {
		return nil, "", err
	}

	if cArt.data != nil && cArt.data_length > 0 {
		data = C.GoBytes(unsafe.Pointer(cArt.data), cArt.data_length)
		mimeType = C.GoString(cArt.mime_type)
		return data, mimeType, nil
	}

	// Fallback: look for image file in parent directory
	parentDir := filepath.Dir(path)
	extensions := []string{".png", ".jpg", ".webp"}

	var foundPath string
	for _, ext := range extensions {
		entries, err := os.ReadDir(parentDir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			if strings.HasSuffix(entry.Name(), ext) {
				foundPath = filepath.Join(parentDir, entry.Name())
				break
			}
		}
		if foundPath != "" {
			break
		}
	}

	if foundPath == "" {
		// Try to find any image file with these extensions
		entries, err := os.ReadDir(parentDir)
		if err != nil {
			return nil, "", nil
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			for _, ext := range extensions {
				if filepath.Ext(entry.Name()) == ext {
					foundPath = filepath.Join(parentDir, entry.Name())
					break
				}
			}
			if foundPath != "" {
				break
			}
		}
	}

	if foundPath == "" {
		return nil, "", nil
	}

	data, err := os.ReadFile(foundPath)
	if err != nil {
		return nil, "", nil
	}

	ext := filepath.Ext(foundPath)
	switch ext {
	case ".png":
		mimeType = "image/png"
	case ".jpg":
		mimeType = "image/jpeg"
	case ".webp":
		mimeType = "image/webp"
	}

	return data, mimeType, nil
}
