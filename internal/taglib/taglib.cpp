#include "taglib.h"
#include <taglib/fileref.h>
#include <taglib/tag.h>
#include <taglib/tpropertymap.h>
#include <cstring>
#include <cstdlib>

extern "C" {

int load_track_metadata(const char* filepath, TrackMetadata* metadata) {
    if (!filepath || !metadata) {
        return 2; // unable to read file
    }
    
    // Initialize metadata
    metadata->title = nullptr;
    metadata->album = nullptr;
    
    // Create TagLib file reference
    TagLib::FileRef file(filepath);
    
    if (file.isNull()) {
        return 1; // file not found
    }
    
    if (!file.tag()) {
        return 2; // unable to read file
    }
    
    TagLib::Tag* tag = file.tag();
    
    // Extract title
    if (!tag->title().isEmpty()) {
        std::string title = tag->title().toCString(true);
        metadata->title = static_cast<char*>(malloc(title.length() + 1));
        if (metadata->title) {
            strcpy(metadata->title, title.c_str());
        }
    } else {
        // If no title, use empty string
        metadata->title = static_cast<char*>(malloc(1));
        if (metadata->title) {
            metadata->title[0] = '\0';
        }
    }
    
    // Extract album
    if (!tag->album().isEmpty()) {
        std::string album = tag->album().toCString(true);
        metadata->album = static_cast<char*>(malloc(album.length() + 1));
        if (metadata->album) {
            strcpy(metadata->album, album.c_str());
        }
    } else {
        // If no album, use empty string
        metadata->album = static_cast<char*>(malloc(1));
        if (metadata->album) {
            metadata->album[0] = '\0';
        }
    }
    
    // Check if memory allocation failed
    if ((!metadata->title && tag->title().isEmpty()) || 
        (!metadata->album && tag->album().isEmpty())) {
        free_track_metadata(metadata);
        return 2; // memory allocation error
    }
    
    return 0; // success
}

void free_track_metadata(TrackMetadata* metadata) {
    if (!metadata) return;
    
    if (metadata->title) {
        free(metadata->title);
        metadata->title = nullptr;
    }
    
    if (metadata->album) {
        free(metadata->album);
        metadata->album = nullptr;
    }
}

} // extern "C"
