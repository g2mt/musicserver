#include <cstdlib>
#include <cstring>
#include <string>
#include <taglib/fileref.h>
#include <taglib/tag.h>
#include <taglib/tpropertymap.h>

#include "bindings.h"

extern "C" {

static const char *FILE_NOT_FOUND_MSG = "file not found";
static const char *UNABLE_TO_READ_MSG = "unable to read file";
static const char *MEMORY_ERROR_MSG = "memory allocation error";

BindingResult load_track_metadata(const char *filepath,
                                  TrackMetadata *metadata) {
  BindingResult result = {nullptr};

  if (!filepath || !metadata) {
    result.err = UNABLE_TO_READ_MSG;
    return result;
  }

  metadata->title = nullptr;
  metadata->artist = nullptr;
  metadata->album = nullptr;

  TagLib::FileRef file(filepath);

  if (file.isNull()) {
    result.err = FILE_NOT_FOUND_MSG;
    return result;
  }

  if (!file.tag()) {
    result.err = UNABLE_TO_READ_MSG;
    return result;
  }

  TagLib::Tag *tag = file.tag();

  auto copy_str = [](const TagLib::String &s) -> char * {
    std::string str = s.isEmpty() ? "" : s.toCString(true);
    char *buf = static_cast<char *>(malloc(str.length() + 1));
    if (buf)
      strcpy(buf, str.c_str());
    return buf;
  };

  metadata->title = copy_str(tag->title());
  metadata->artist = copy_str(tag->artist());
  metadata->album = copy_str(tag->album());

  if (!metadata->title || !metadata->artist || !metadata->album) {
    free_track_metadata(metadata);
    result.err = MEMORY_ERROR_MSG;
    return result;
  }

  return result;
}

void free_track_metadata(TrackMetadata *metadata) {
  if (!metadata)
    return;

  free(metadata->title);
  metadata->title = nullptr;
  free(metadata->artist);
  metadata->artist = nullptr;
  free(metadata->album);
  metadata->album = nullptr;
}

BindingResult extract_cover_art(const char *filepath, CoverArt *cover_art) {
  BindingResult result = {nullptr};

  if (!filepath || !cover_art) {
    result.err = UNABLE_TO_READ_MSG;
    return result;
  }

  cover_art->data = nullptr;
  cover_art->data_length = 0;
  cover_art->mime_type = nullptr;

  TagLib::FileRef file(filepath);
  if (file.isNull()) {
    result.err = FILE_NOT_FOUND_MSG;
    return result;
  }

  auto pictures = file.complexProperties("PICTURE");
  if (pictures.isEmpty())
    return result; // no cover art, not an error

  const auto &pic = pictures.front();

  auto dataIt = pic.find("data");
  auto mimeIt = pic.find("mimeType");
  if (dataIt == pic.end() || mimeIt == pic.end())
    return result; // malformed picture property, treat as no cover art

  const TagLib::ByteVector &bytes = (*dataIt).second.toByteVector();
  std::string mime = (*mimeIt).second.toString().toCString(true);

  if (bytes.size() == 0)
    return result;

  cover_art->data =
      static_cast<unsigned char *>(malloc(bytes.size()));
  if (!cover_art->data) {
    result.err = MEMORY_ERROR_MSG;
    return result;
  }
  memcpy(cover_art->data, bytes.data(), bytes.size());
  cover_art->data_length = static_cast<int>(bytes.size());
  cover_art->mime_type = strdup(mime.c_str());
  if (!cover_art->mime_type) {
    free(cover_art->data);
    cover_art->data = nullptr;
    result.err = MEMORY_ERROR_MSG;
    return result;
  }

  return result;
}

void free_cover_art(CoverArt *cover_art) {
  if (!cover_art)
    return;
  free(cover_art->data);
  cover_art->data = nullptr;
  free(cover_art->mime_type);
  cover_art->mime_type = nullptr;
  cover_art->data_length = 0;
}

} // extern "C"
