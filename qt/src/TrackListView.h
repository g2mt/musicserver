#pragma once

#include <QList>
#include <QString>
#include <QWidget>

#include "TrackData.h"

class QListView;
class TrackListModel;

class TrackListView : public QWidget {
  Q_OBJECT
public:
  enum class Action { Enqueue, Unqueue };

  explicit TrackListView(Action action, QWidget *parent = nullptr);

  void setTracks(const QList<TrackData> &tracks);
  void insertTracks(const QList<TrackData> &tracks, int startIndex);
  void removeTracks(int startIndex, int count);
  const QList<TrackData> &tracks() const;
  void setHighlightedTrackId(const QString &id);
  QString highlightedTrackId() const;
  void scrollToTop();

signals:
  void playRequested(const TrackData &track, int row);
  void enqueueRequested(const TrackData &track);
  void unqueueRequested(int row);
  void removeAllRequested();
  void shuffleRequested();
  void searchRequested(const QString &query);

private:
  void setupUi();
  void fetchCover(const QString &trackId);

  Action m_action;
  QListView *m_view = nullptr;
  TrackListModel *m_model = nullptr;
};
