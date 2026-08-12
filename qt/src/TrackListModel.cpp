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
  case CoverPixmapRole:
  case Qt::DecorationRole:
    return QVariant::fromValue(m_covers.value(index.row()));
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
  m_covers.clear();
  m_coverRequested.clear();
  for (int i = 0; i < tracks.size(); ++i) {
    m_covers.append(QPixmap());
  }
  endResetModel();
}

void TrackListModel::setCoverPixmap(const QString &trackId,
                                    const QPixmap &pixmap) {
  for (int i = 0; i < m_tracks.size(); ++i) {
    if (m_tracks.at(i).id == trackId) {
      m_covers[i] = pixmap;
      QModelIndex idx = index(i);
      emit dataChanged(idx, idx, {CoverPixmapRole, Qt::DecorationRole});
      return;
    }
  }
}

void TrackListModel::ensureCoverLoaded(int row) {
  if (row < 0 || row >= m_tracks.size())
    return;
  if (m_coverRequested.contains(row))
    return;
  if (!m_covers.value(row).isNull())
    return;

  const QString &trackId = m_tracks.at(row).id;
  if (trackId.isEmpty())
    return;

  m_coverRequested.insert(row);
  emit coverRequested(row, trackId);
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
  roles[CoverPixmapRole] = "coverPixmap";
  roles[TrackDataRole] = "trackData";
  return roles;
}