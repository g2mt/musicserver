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

BindingResult MsrvTlLoadTrackMetadata(const char *filepath,
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
    MsrvTlFreeTrackMetadata(metadata);
    result.err = MEMORY_ERROR_MSG;
    return result;
  }

  return result;
}

void MsrvTlFreeTrackMetadata(TrackMetadata *metadata) {
  if (!metadata)
    return;

  free(metadata->title);
  metadata->title = nullptr;
  free(metadata->artist);
  metadata->artist = nullptr;
  free(metadata->album);
  metadata->album = nullptr;
}

BindingResult MsrvTlExtractCoverArt(const char *filepath, CoverArt *coverArt) {
  BindingResult result = {nullptr};

  if (!filepath || !coverArt) {
    result.err = UNABLE_TO_READ_MSG;
    return result;
  }

  coverArt->data = nullptr;
  coverArt->dataLength = 0;
  coverArt->mimeType = nullptr;

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

  coverArt->data = static_cast<unsigned char *>(malloc(bytes.size()));
  if (!coverArt->data) {
    result.err = MEMORY_ERROR_MSG;
    return result;
  }
  memcpy(coverArt->data, bytes.data(), bytes.size());
  coverArt->dataLength = static_cast<int>(bytes.size());
  coverArt->mimeType = strdup(mime.c_str());
  if (!coverArt->mimeType) {
    free(coverArt->data);
    coverArt->data = nullptr;
    result.err = MEMORY_ERROR_MSG;
    return result;
  }

  return result;
}

void MsrvTlFreeCoverArt(CoverArt *coverArt) {
  if (!coverArt)
    return;
  free(coverArt->data);
  coverArt->data = nullptr;
  free(coverArt->mimeType);
  coverArt->mimeType = nullptr;
  coverArt->dataLength = 0;
}

} // extern "C"
