#pragma once

#include <QJsonArray>
#include <QJsonObject>
#include <QList>
#include <QString>

struct TrackData {
  QString id;
  QString shortId;
  QString name;
  QString artist;
  QString album;
  QString path;
  QString thumbnailPath;

  static TrackData fromJson(const QJsonObject &obj) {
    TrackData t;
    t.id = obj["id"].toString();
    t.shortId = obj["short_id"].toString();
    t.name = obj["name"].toString();
    t.artist = obj["artist"].toString();
    t.album = obj["album"].toString();
    t.path = obj["path"].toString();
    t.thumbnailPath = obj["thumbnail_path"].toString();
    return t;
  }
};

struct TrackListResult {
  QString sortFilter;
  bool desc;
  int limit;
  QList<TrackData> tracks;

  static TrackListResult fromJson(const QJsonObject &obj) {
    TrackListResult r;
    QJsonObject filters = obj["filters"].toObject();
    r.sortFilter = filters["sort"].toString();
    r.desc = filters["desc"].toString() == "1";
    r.limit = obj["limit"].toInt();

    QJsonArray arr = obj["tracks"].toArray();
    for (const auto &v : arr) {
      r.tracks.append(TrackData::fromJson(v.toObject()));
    }
    return r;
  }
};

Q_DECLARE_METATYPE(TrackData)