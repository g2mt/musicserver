package api

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type FileList struct {
	Files       []string `json:"files"`
	Directories []string `json:"directories"`
}

func (i *Interface) GetFilesInPath(path string) (FileList, error) {
	fullPath := filepath.Join(i.config.DataPath, path)

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
