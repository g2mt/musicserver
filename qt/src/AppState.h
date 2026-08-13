#pragma once

#include <QJsonArray>
#include <QJsonObject>
#include <QList>
#include <QObject>
#include <QString>
#include <QStringList>

#include "Bookmark.h"
#include "TrackData.h"

enum class LeftTab { Tracks, Bookmarks, Files, Settings };
enum class RepeatMode { None, Track, Queue };

class AppState : public QObject {
  Q_OBJECT
public:
  static AppState *instance();

  // Audio state
  TrackData *currentTrack() const;
  bool isPlaying() const;
  double progress() const;
  double duration() const;
  double volume() const;
  bool muted() const;
  double amplification() const;
  bool normalize() const;
  RepeatMode repeat() const;

  // Search state
  QString searchQuery() const;
  QString resultSort() const;
  bool resultDesc() const;
  int resultLimit() const;

  // Queue state
  QList<TrackData> queueTracks() const;
  int queueIndex() const;
  bool canNext() const;
  bool canPrev() const;

  // UI state
  LeftTab leftTab() const;
  bool tracksListCollapsed() const;
  bool queueCollapsed() const;
  bool darkMode() const;
  bool showBlurredCover() const;
  bool showOnlyQueueAfterEnqueue() const;
  bool shuffleBeforePlayingAll() const;
  bool showTracksListOnTabChange() const;
  int searchHistoryLimit() const;
  QString highlightedTrackId() const;

  // File browser
  QStringList fbPath() const;

  // Bookmarks
  QList<Bookmark> bookmarks() const;

  // Settings
  double targetNormalizationDbs() const;
  double maxNormalizationDbs() const;

  // Server config
  QJsonObject serverProps() const;

public slots:
  // Audio
  void setCurrentTrack(const TrackData &track);
  void setIsPlaying(bool playing);
  void setProgress(double secs);
  void setDuration(double secs);
  void setVolume(double vol);
  void setMuted(bool mut);
  void setAmplification(double db);
  void setNormalize(bool norm);
  void setRepeat(RepeatMode mode);

  // Search
  void setSearchQuery(const QString &query, int limit = 0);
  void setResultSort(const QString &sort, bool desc);
  void setResultLimit(int limit);

  // Queue
  void setQueueTracks(const QList<TrackData> &tracks);
  void setQueueIndex(int index);
  void queueAdd(const TrackData &track);
  void queueAddAll(const QList<TrackData> &tracks);
  void queueRemove(int index);
  void queueClear();
  void queueShuffle();
  void queuePlayAll(const QList<TrackData> &tracks);
  void queueNext();
  void queuePrev();

  // UI
  void setLeftTab(LeftTab tab);
  void setTracksListCollapsed(bool collapsed);
  void setQueueCollapsed(bool collapsed);
  void setDarkMode(bool dark);
  void setShowBlurredCover(bool show);
  void setShowOnlyQueueAfterEnqueue(bool show);
  void setShuffleBeforePlayingAll(bool shuffle);
  void setShowTracksListOnTabChange(bool show);
  void setSearchHistoryLimit(int limit);
  void setHighlightedTrackId(const QString &id);

  // File browser
  void setFbPath(const QStringList &path);

  // Bookmarks
  void setBookmarks(const QList<Bookmark> &list);
  void addBookmark(const Bookmark &bm);
  void removeBookmark(int index);

  // Settings
  void setTargetNormalizationDbs(double db);
  void setMaxNormalizationDbs(double db);
  void setServerProps(const QJsonObject &props);

  // Load/save config
  void loadConfig();
  void saveConfig();

signals:
  // Audio
  void currentTrackChanged(const TrackData &track);
  void isPlayingChanged(bool playing);
  void progressChanged(double secs);
  void durationChanged(double secs);
  void volumeChanged(double vol);
  void mutedChanged(bool muted);
  void amplificationChanged(double db);
  void normalizeChanged(bool norm);
  void repeatChanged(RepeatMode mode);

  // Search
  void searchQueryChanged(const QString &query, int limit);
  void resultSortChanged(const QString &sort, bool desc);
  void resultLimitChanged(int limit);

  // Queue
  void queueTracksChanged(const QList<TrackData> &tracks);
  void queueTracksAdded(const QList<TrackData> &tracks, int startIndex);
  void queueTracksRemoved(int startIndex, int count);
  void queueIndexChanged(int index);

  // UI
  void leftTabChanged(LeftTab tab);
  void tracksListCollapsedChanged(bool collapsed);
  void queueCollapsedChanged(bool collapsed);
  void darkModeChanged(bool dark);
  void showBlurredCoverChanged(bool show);
  void showOnlyQueueAfterEnqueueChanged(bool show);
  void shuffleBeforePlayingAllChanged(bool shuffle);
  void showTracksListOnTabChangeChanged(bool show);
  void searchHistoryLimitChanged(int limit);
  void highlightedTrackIdChanged(const QString &id);

  // File browser
  void fbPathChanged(const QStringList &path);

  // Bookmarks
  void bookmarksChanged(const QList<Bookmark> &list);

  // Settings
  void targetNormalizationDbsChanged(double db);
  void maxNormalizationDbsChanged(double db);
  void serverPropsChanged(const QJsonObject &props);

private:
  explicit AppState(QObject *parent = nullptr);
  static AppState *s_instance;

  // Audio
  TrackData m_currentTrack;
  bool m_isPlaying = false;
  double m_progress = 0.0;
  double m_duration = 0.0;
  double m_volume = 1.0;
  bool m_muted = false;
  double m_amplification = 0.0;
  bool m_normalize = false;
  RepeatMode m_repeat = RepeatMode::None;

  // Search
  QString m_searchQuery;
  QString m_resultSort;
  bool m_resultDesc = false;
  int m_resultLimit = -1;

  // Queue
  QList<TrackData> m_queueTracks;
  int m_queueIndex = -1;

  // UI
  LeftTab m_leftTab = LeftTab::Tracks;
  bool m_tracksListCollapsed = false;
  bool m_queueCollapsed = false;
  bool m_darkMode = false;
  bool m_showBlurredCover = true;
  bool m_showOnlyQueueAfterEnqueue = false;
  bool m_shuffleBeforePlayingAll = true;
  bool m_showTracksListOnTabChange = false;
  int m_searchHistoryLimit = 10;
  QString m_highlightedTrackId;

  // File browser
  QStringList m_fbPath;

  // Bookmarks
  QList<Bookmark> m_bookmarks;

  // Settings
  double m_targetNormalizationDbs = 0.0;
  double m_maxNormalizationDbs = 8.0;

  // Server
  QJsonObject m_serverProps;
};