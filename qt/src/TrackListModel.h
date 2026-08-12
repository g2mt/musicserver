#pragma once

#include "TrackData.h"
#include <QAbstractListModel>
#include <QList>
#include <QPixmap>
#include <QSet>

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
  void ensureCoverLoaded(int row);
  const QList<TrackData> &tracks() const;

signals:
  void coverRequested(int row, const QString &trackId);

protected:
  QHash<int, QByteArray> roleNames() const override;

private:
  QList<TrackData> m_tracks;
  QList<QPixmap> m_covers;
  QSet<int> m_coverRequested;
};