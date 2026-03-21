#ifndef TAGLIB_BINDINGS_H
#define TAGLIB_BINDINGS_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char* title;
    char* album;
} TrackMetadata;

// Load track metadata from file
// Returns:
//   0 - success
//   1 - file not found
//   2 - unable to read file
//   3 - unsupported file format
int load_track_metadata(const char* filepath, TrackMetadata* metadata);

// Free memory allocated for track metadata
void free_track_metadata(TrackMetadata* metadata);

#ifdef __cplusplus
}
#endif

#endif // TAGLIB_BINDINGS_H
