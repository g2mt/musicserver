#pragma once

#include "TrackData.h"
#include <QAbstractListModel>
#include <QList>
#include <QPixmap>

class TrackListModel : public QAbstractListModel {
  Q_OBJECT
public:
  enum Roles {
    TrackIdRole = Qt::UserRole + 1,
    ShortIdRole,
    NameRole,
    ArtistRole,
    AlbumRole,
    PathRole,
    ThumbnailPathRole,
    CoverPixmapRole,
    TrackDataRole,
  };

  explicit TrackListModel(QObject *parent = nullptr);

  int rowCount(const QModelIndex &parent = QModelIndex()) const override;
  QVariant data(const QModelIndex &index,
                int role = Qt::DisplayRole) const override;

  void setTracks(const QList<TrackData> &tracks);
  void setCoverPixmap(const QString &trackId, const QPixmap &pixmap);
  const QList<TrackData> &tracks() const;

protected:
  QHash<int, QByteArray> roleNames() const override;

private:
  QList<TrackData> m_tracks;
  QList<QPixmap> m_covers;
};