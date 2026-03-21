#include <taglib/fileref.h>
#include <taglib/tag.h>
#include <taglib/tpropertymap.h>
#include <taglib/mpegfile.h>
#include <taglib/id3v2tag.h>
#include <taglib/attachedpictureframe.h>
#include <taglib/mp4file.h>
#include <taglib/mp4tag.h>
#include <taglib/mp4coverart.h>
#include <taglib/flacfile.h>
#include <taglib/flacpicture.h>
#include <taglib/vorbisfile.h>
#include <taglib/xiphcomment.h>
#include <taglib/opusfile.h>
#include <taglib/speexfile.h>
#include <taglib/asffile.h>
#include <taglib/asftag.h>
#include <taglib/aifffile.h>
#include <taglib/wavfile.h>
#include <cstring>
#include <cstdlib>
#include <string>

#include "bindings.h"

extern "C" {

static const char* FILE_NOT_FOUND_MSG = "file not found";
static const char* UNABLE_TO_READ_MSG = "unable to read file";
static const char* UNSUPPORTED_FORMAT_MSG = "unsupported file format";
static const char* MEMORY_ERROR_MSG = "memory allocation error";

BindingResult load_track_metadata(const char* filepath, TrackMetadata* metadata) {
    BindingResult result = {nullptr};
    
    if (!filepath || !metadata) {
        result.err = UNABLE_TO_READ_MSG;
        return result;
    }

    // Initialize metadata
    metadata->title = nullptr;
    metadata->album = nullptr;

    // Create TagLib file reference
    TagLib::FileRef file(filepath);

    if (file.isNull()) {
        result.err = FILE_NOT_FOUND_MSG;
        return result;
    }

    if (!file.tag()) {
        result.err = UNABLE_TO_READ_MSG;
        return result;
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
        result.err = MEMORY_ERROR_MSG;
        return result;
    }

    return result; // success, err = nullptr
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

static bool fill_cover_art(CoverArt* cover_art, const unsigned char* data, size_t size, const char* mime) {
    cover_art->data = static_cast<unsigned char*>(malloc(size));
    if (!cover_art->data) return false;
    memcpy(cover_art->data, data, size);
    cover_art->data_length = static_cast<int>(size);
    cover_art->mime_type = strdup(mime);
    if (!cover_art->mime_type) {
        free(cover_art->data);
        cover_art->data = nullptr;
        return false;
    }
    return true;
}

static const char* mp4_cover_mime(TagLib::MP4::CoverArt::Format fmt) {
    switch (fmt) {
        case TagLib::MP4::CoverArt::PNG:  return "image/png";
        case TagLib::MP4::CoverArt::JPEG: return "image/jpeg";
        case TagLib::MP4::CoverArt::BMP:  return "image/bmp";
        case TagLib::MP4::CoverArt::GIF:  return "image/gif";
        default:                          return "application/octet-stream";
    }
}

BindingResult extract_cover_art(const char* filepath, CoverArt* cover_art) {
    BindingResult result = {nullptr};
    
    if (!filepath || !cover_art) {
        result.err = UNABLE_TO_READ_MSG;
        return result;
    }

    cover_art->data = nullptr;
    cover_art->data_length = 0;
    cover_art->mime_type = nullptr;

    std::string path(filepath);
    std::string ext;
    auto dot = path.rfind('.');
    if (dot != std::string::npos) {
        ext = path.substr(dot + 1);
        for (auto& c : ext) c = tolower(c);
    }

    // MP3 / ID3v2
    if (ext == "mp3") {
        TagLib::MPEG::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.ID3v2Tag();
        if (tag) {
            auto frames = tag->frameListMap()["APIC"];
            if (!frames.isEmpty()) {
                auto* frame = dynamic_cast<TagLib::ID3v2::AttachedPictureFrame*>(frames.front());
                if (frame && frame->picture().size() > 0) {
                    std::string mime = frame->mimeType().toCString(true);
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(frame->picture().data()),
                            frame->picture().size(), mime.c_str())) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // MP4 / AAC / M4A / M4B
    if (ext == "mp4" || ext == "m4a" || ext == "m4b" || ext == "m4r" || ext == "aac") {
        TagLib::MP4::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.tag();
        if (tag && tag->contains("covr")) {
            auto list = tag->item("covr").toCoverArtList();
            if (!list.isEmpty()) {
                const auto& art = list.front();
                if (art.data().size() > 0) {
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(art.data().data()),
                            art.data().size(), mp4_cover_mime(art.format()))) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // FLAC
    if (ext == "flac") {
        TagLib::FLAC::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        const auto& pics = f.pictureList();
        if (!pics.isEmpty()) {
            const auto* pic = pics.front();
            if (pic && pic->data().size() > 0) {
                std::string mime = pic->mimeType().toCString(true);
                if (!fill_cover_art(cover_art,
                        reinterpret_cast<const unsigned char*>(pic->data().data()),
                        pic->data().size(), mime.c_str())) {
                    result.err = MEMORY_ERROR_MSG;
                    return result;
                }
                return result; // success
            }
        }
        return result; // no cover art found, not an error
    }

    // Ogg Vorbis
    if (ext == "ogg" || ext == "oga") {
        TagLib::Ogg::Vorbis::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.tag();
        if (tag) {
            const auto& pics = tag->pictureList();
            if (!pics.isEmpty()) {
                const auto* pic = pics.front();
                if (pic && pic->data().size() > 0) {
                    std::string mime = pic->mimeType().toCString(true);
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(pic->data().data()),
                            pic->data().size(), mime.c_str())) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // Opus
    if (ext == "opus") {
        TagLib::Ogg::Opus::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.tag();
        if (tag) {
            const auto& pics = tag->pictureList();
            if (!pics.isEmpty()) {
                const auto* pic = pics.front();
                if (pic && pic->data().size() > 0) {
                    std::string mime = pic->mimeType().toCString(true);
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(pic->data().data()),
                            pic->data().size(), mime.c_str())) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // Speex
    if (ext == "spx") {
        TagLib::Ogg::Speex::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.tag();
        if (tag) {
            const auto& pics = tag->pictureList();
            if (!pics.isEmpty()) {
                const auto* pic = pics.front();
                if (pic && pic->data().size() > 0) {
                    std::string mime = pic->mimeType().toCString(true);
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(pic->data().data()),
                            pic->data().size(), mime.c_str())) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // ASF / WMA / WMV
    if (ext == "wma" || ext == "wmv" || ext == "asf") {
        TagLib::ASF::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.tag();
        if (tag && tag->attributeListMap().contains("WM/Picture")) {
            const auto& attrs = tag->attributeListMap()["WM/Picture"];
            if (!attrs.isEmpty()) {
                const auto& pic = attrs.front().toPicture();
                if (pic.dataSize() > 0) {
                    std::string mime = pic.mimeType().toCString(true);
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(pic.picture().data()),
                            pic.picture().size(), mime.c_str())) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // AIFF
    if (ext == "aiff" || ext == "aif") {
        TagLib::RIFF::AIFF::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.tag();
        if (tag) {
            auto frames = tag->frameListMap()["APIC"];
            if (!frames.isEmpty()) {
                auto* frame = dynamic_cast<TagLib::ID3v2::AttachedPictureFrame*>(frames.front());
                if (frame && frame->picture().size() > 0) {
                    std::string mime = frame->mimeType().toCString(true);
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(frame->picture().data()),
                            frame->picture().size(), mime.c_str())) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // WAV
    if (ext == "wav") {
        TagLib::RIFF::WAV::File f(filepath);
        if (!f.isValid()) {
            result.err = FILE_NOT_FOUND_MSG;
            return result;
        }
        auto* tag = f.ID3v2Tag();
        if (tag) {
            auto frames = tag->frameListMap()["APIC"];
            if (!frames.isEmpty()) {
                auto* frame = dynamic_cast<TagLib::ID3v2::AttachedPictureFrame*>(frames.front());
                if (frame && frame->picture().size() > 0) {
                    std::string mime = frame->mimeType().toCString(true);
                    if (!fill_cover_art(cover_art,
                            reinterpret_cast<const unsigned char*>(frame->picture().data()),
                            frame->picture().size(), mime.c_str())) {
                        result.err = MEMORY_ERROR_MSG;
                        return result;
                    }
                    return result; // success
                }
            }
        }
        return result; // no cover art found, not an error
    }

    // Fallback: try generic FileRef (won't yield cover art but at least validates the file)
    TagLib::FileRef f(filepath);
    if (f.isNull()) {
        result.err = FILE_NOT_FOUND_MSG;
        return result;
    }

    return result; // no cover art found, not an error
}

void free_cover_art(CoverArt* cover_art) {
    if (!cover_art) return;
    if (cover_art->data) {
        free(cover_art->data);
        cover_art->data = nullptr;
    }
    if (cover_art->mime_type) {
        free(cover_art->mime_type);
        cover_art->mime_type = nullptr;
    }
    cover_art->data_length = 0;
}

} // extern "C"
