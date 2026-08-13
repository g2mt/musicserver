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
  case HighlightedRole:
    return !m_highlightedTrackId.isEmpty() &&
           track.id == m_highlightedTrackId;
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
  rebuildRowByTrackId();
  endResetModel();
}

void TrackListModel::insertTracks(const QList<TrackData> &tracks,
                                  int startIndex) {
  if (tracks.isEmpty())
    return;
  startIndex = qBound(0, startIndex, m_tracks.size());

  beginInsertRows(QModelIndex(), startIndex,
                  startIndex + tracks.size() - 1);
  for (int i = 0; i < tracks.size(); ++i) {
    m_tracks.insert(startIndex + i, tracks.at(i));
    m_covers.insert(startIndex + i, QPixmap());
  }
  m_coverRequested.clear();
  rebuildRowByTrackId();
  endInsertRows();
}

void TrackListModel::removeTracks(int startIndex, int count) {
  if (count <= 0 || startIndex < 0 || startIndex >= m_tracks.size())
    return;
  count = qMin(count, m_tracks.size() - startIndex);

  beginRemoveRows(QModelIndex(), startIndex, startIndex + count - 1);
  for (int i = 0; i < count; ++i) {
    m_tracks.removeAt(startIndex);
    m_covers.removeAt(startIndex);
  }
  m_coverRequested.clear();
  rebuildRowByTrackId();
  endRemoveRows();
}

void TrackListModel::rebuildRowByTrackId() {
  m_rowByTrackId.clear();
  for (int i = 0; i < m_tracks.size(); ++i) {
    const QString &id = m_tracks.at(i).id;
    if (!id.isEmpty())
      m_rowByTrackId.insert(id, i);
  }
}

void TrackListModel::setHighlightedTrackId(const QString &id) {
  if (m_highlightedTrackId == id)
    return;

  const int oldRow = m_highlightedTrackId.isEmpty()
                         ? -1
                         : m_rowByTrackId.value(m_highlightedTrackId, -1);
  const int newRow = id.isEmpty() ? -1 : m_rowByTrackId.value(id, -1);

  m_highlightedTrackId = id;

  if (oldRow >= 0) {
    const QModelIndex idx = index(oldRow);
    emit dataChanged(idx, idx, {HighlightedRole});
  }
  if (newRow >= 0 && newRow != oldRow) {
    const QModelIndex idx = index(newRow);
    emit dataChanged(idx, idx, {HighlightedRole});
  }
}

QString TrackListModel::highlightedTrackId() const {
  return m_highlightedTrackId;
}

void TrackListModel::setCoverPixmap(const QString &trackId,
                                    const QPixmap &pixmap) {
  const int i = m_rowByTrackId.value(trackId, -1);
  if (i < 0 || i >= m_tracks.size())
    return;
  if (m_tracks.at(i).id != trackId)
    return;

  m_covers[i] = pixmap;
  const QModelIndex idx = index(i);
  emit dataChanged(idx, idx, {CoverPixmapRole, Qt::DecorationRole});
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
  roles[HighlightedRole] = "highlighted";
  return roles;
}