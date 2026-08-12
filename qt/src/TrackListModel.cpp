#include "TrackListModel.h"

TrackListModel::TrackListModel(QObject *parent) : QAbstractListModel(parent) {}

int TrackListModel::rowCount(const QModelIndex &parent) const {
  if (parent.isValid())
    return 0;
  return m_tracks.size();
}

QVariant TrackListModel::data(const QModelIndex &index, int role) const {
  if (!index.isValid() || index.row() >= m_tracks.size())
    return QVariant();

  const TrackData &track = m_tracks.at(index.row());
  switch (role) {
  case TrackIdRole:
    return track.id;
  case ShortIdRole:
    return track.shortId;
  case NameRole:
    return track.name;
  case ArtistRole:
    return track.artist;
  case AlbumRole:
    return track.album;
  case PathRole:
    return track.path;
  case ThumbnailPathRole:
    return track.thumbnailPath;
  case TrackDataRole:
    return QVariant::fromValue(track);
  case Qt::DisplayRole:
    return track.name;
  default:
    return QVariant();
  }
}

void TrackListModel::setTracks(const QList<TrackData> &tracks) {
  beginResetModel();
  m_tracks = tracks;
  endResetModel();
}

const QList<TrackData> &TrackListModel::tracks() const { return m_tracks; }

QHash<int, QByteArray> TrackListModel::roleNames() const {
  QHash<int, QByteArray> roles;
  roles[TrackIdRole] = "trackId";
  roles[ShortIdRole] = "shortId";
  roles[NameRole] = "name";
  roles[ArtistRole] = "artist";
  roles[AlbumRole] = "album";
  roles[PathRole] = "path";
  roles[ThumbnailPathRole] = "thumbnailPath";
  roles[TrackDataRole] = "trackData";
  return roles;
}