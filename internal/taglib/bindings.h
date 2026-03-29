#ifndef TAGLIB_BINDINGS_H
#define TAGLIB_BINDINGS_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  const char *err; // static string error message, nullptr if no error
} BindingResult;

typedef struct {
  char *title;
  char *artist;
  char *album;
} TrackMetadata;

typedef struct {
  unsigned char *data;
  int dataLength;
  char *mimeType;
} CoverArt;

// Load track metadata from file
BindingResult MsrvTlLoadTrackMetadata(const char *filepath,
                                      TrackMetadata *metadata);

// Free memory allocated for track metadata
void MsrvTlFreeTrackMetadata(TrackMetadata *metadata);

// Extract cover art from file
BindingResult MsrvTlExtractCoverArt(const char *filepath, CoverArt *coverArt);

// Free memory allocated for cover art
void MsrvTlFreeCoverArt(CoverArt *coverArt);

#ifdef __cplusplus
}
#endif

#endif // TAGLIB_BINDINGS_H
