#pragma once

#include <QAbstractListModel>
#include <QList>
#include "TrackData.h"

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
		TrackDataRole,
	};

	explicit TrackListModel(QObject *parent = nullptr);

	int rowCount(const QModelIndex &parent = QModelIndex()) const override;
	QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;

	void setTracks(const QList<TrackData> &tracks);
	const QList<TrackData> &tracks() const;

protected:
	QHash<int, QByteArray> roleNames() const override;

private:
	QList<TrackData> m_tracks;
};