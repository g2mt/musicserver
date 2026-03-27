package api

import (
	"os"
	"path/filepath"
)

type FileList struct {
	Files       []string `json:"files"`
	Directories []string `json:"directories"`
}

// Requires the path to be an absolute path prefixed by i.config.DataPath
func (i *Interface) getFilesInPath(fullPath string) (FileList, error) {
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return FileList{}, err
	}

	var files []string
	var directories []string

	for _, entry := range entries {
		if entry.IsDir() {
			directories = append(directories, entry.Name())
		} else {
			files = append(files, entry.Name())
		}
	}

	return FileList{
		Files:       files,
		Directories: directories,
	}, nil
}

func (i *Interface) ReadFileInPath(path string) (interface{}, error) {
	fullPath := filepath.Join(i.config.DataPath, path)

	info, err := os.Stat(fullPath)
	if err != nil {
		return nil, err
	}

	if info.IsDir() {
		return i.getFilesInPath(fullPath)
	}

	return os.ReadFile(fullPath)
}
