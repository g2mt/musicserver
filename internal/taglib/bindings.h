#ifndef TAGLIB_BINDINGS_H
#define TAGLIB_BINDINGS_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char* err; // static string error message, nullptr if no error
} BindingResult;

typedef struct {
    char* title;
    char* album;
} TrackMetadata;

typedef struct {
    unsigned char* data;
    int data_length;
    char* mime_type;
} CoverArt;

// Load track metadata from file
// Returns:
//   0 - success
//   1 - file not found
//   2 - unable to read file
//   3 - unsupported file format
int load_track_metadata(const char* filepath, TrackMetadata* metadata);

// Free memory allocated for track metadata
void free_track_metadata(TrackMetadata* metadata);

// Extract cover art from file
// Returns:
//   0 - success (art may still be empty if none found)
//   1 - file not found
//   2 - unable to read file
//   3 - unsupported file format
int extract_cover_art(const char* filepath, CoverArt* cover_art);

// Free memory allocated for cover art
void free_cover_art(CoverArt* cover_art);

#ifdef __cplusplus
}
#endif

#endif // TAGLIB_BINDINGS_H
