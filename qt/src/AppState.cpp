#include "AppState.h"

#include <QDebug>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRandomGenerator>
#include <QSettings>

AppState *AppState::s_instance = nullptr;

AppState::AppState(QObject *parent) : QObject(parent) {}

AppState *AppState::instance() {
  if (!s_instance)
    s_instance = new AppState();
  return s_instance;
}

// --- Audio ---

TrackData *AppState::currentTrack() const {
  return const_cast<TrackData *>(&m_currentTrack);
}

bool AppState::isPlaying() const { return m_isPlaying; }
double AppState::progress() const { return m_progress; }
double AppState::duration() const { return m_duration; }
double AppState::volume() const { return m_volume; }
bool AppState::muted() const { return m_muted; }
double AppState::amplification() const { return m_amplification; }
bool AppState::normalize() const { return m_normalize; }
RepeatMode AppState::repeat() const { return m_repeat; }

void AppState::setCurrentTrack(const TrackData &track) {
  if (m_currentTrack.id == track.id && m_currentTrack.path == track.path)
    return;
  m_currentTrack = track;
  emit currentTrackChanged(track);
}

void AppState::setIsPlaying(bool playing) {
  if (m_isPlaying == playing)
    return;
  m_isPlaying = playing;
  emit isPlayingChanged(playing);
}

void AppState::setProgress(double secs) {
  if (m_progress == secs)
    return;
  m_progress = secs;
  emit progressChanged(secs);
}

void AppState::setDuration(double secs) {
  if (m_duration == secs)
    return;
  m_duration = secs;
  emit durationChanged(secs);
}

void AppState::setVolume(double vol) {
  if (m_volume == vol)
    return;
  m_volume = vol;
  emit volumeChanged(vol);
}

void AppState::setMuted(bool mut) {
  if (m_muted == mut)
    return;
  m_muted = mut;
  emit mutedChanged(mut);
}

void AppState::setAmplification(double db) {
  if (m_amplification == db)
    return;
  m_amplification = db;
  emit amplificationChanged(db);
}

void AppState::setNormalize(bool norm) {
  if (m_normalize == norm)
    return;
  m_normalize = norm;
  emit normalizeChanged(norm);
}

void AppState::setRepeat(RepeatMode mode) {
  if (m_repeat == mode)
    return;
  m_repeat = mode;
  emit repeatChanged(mode);
}

// --- Search ---

QString AppState::searchQuery() const { return m_searchQuery; }
QString AppState::resultSort() const { return m_resultSort; }
bool AppState::resultDesc() const { return m_resultDesc; }
int AppState::resultLimit() const { return m_resultLimit; }

void AppState::setSearchQuery(const QString &query, int limit) {
  if (m_searchQuery == query && m_resultLimit == limit)
    return;
  m_searchQuery = query;
  m_resultLimit = limit;
  emit searchQueryChanged(query, limit);
}

void AppState::setResultSort(const QString &sort, bool desc) {
  if (m_resultSort == sort && m_resultDesc == desc)
    return;
  m_resultSort = sort;
  m_resultDesc = desc;
  emit resultSortChanged(sort, desc);
}

void AppState::setResultLimit(int limit) {
  if (m_resultLimit == limit)
    return;
  m_resultLimit = limit;
  emit resultLimitChanged(limit);
}

// --- Queue ---

QList<TrackData> AppState::queueTracks() const { return m_queueTracks; }
int AppState::queueIndex() const { return m_queueIndex; }

bool AppState::canNext() const {
  if (m_repeat == RepeatMode::Track)
    return !m_currentTrack.id.isEmpty() || !m_currentTrack.path.isEmpty();
  const int nextIdx = m_queueIndex + 1;
  return !m_queueTracks.isEmpty() &&
         (nextIdx < m_queueTracks.size() || m_repeat == RepeatMode::Queue);
}

bool AppState::canPrev() const { return m_queueIndex > 0; }

void AppState::setQueueTracks(const QList<TrackData> &tracks) {
  m_queueTracks = tracks;
  emit queueTracksChanged(tracks);
}

void AppState::setQueueIndex(int index) {
  if (m_queueIndex == index)
    return;
  m_queueIndex = index;
  emit queueIndexChanged(index);
}

void AppState::queueAdd(const TrackData &track) {
  m_queueTracks.append(track);
  emit queueTracksChanged(m_queueTracks);
}

void AppState::queueAddAll(const QList<TrackData> &tracks) {
  m_queueTracks.append(tracks);
  emit queueTracksChanged(m_queueTracks);
}

void AppState::queueRemove(int index) {
  if (index < 0 || index >= m_queueTracks.size())
    return;
  m_queueTracks.removeAt(index);
  if (m_queueIndex == index) {
    m_queueIndex = -1;
    emit queueIndexChanged(-1);
  } else if (m_queueIndex > index) {
    m_queueIndex--;
    emit queueIndexChanged(m_queueIndex);
  }
  emit queueTracksChanged(m_queueTracks);
}

void AppState::queueClear() {
  m_queueTracks.clear();
  m_queueIndex = -1;
  emit queueTracksChanged(m_queueTracks);
  emit queueIndexChanged(-1);
}

void AppState::queueShuffle() {
  if (m_queueTracks.size() < 2)
    return;

  QList<TrackData> tracks = m_queueTracks;
  for (int i = tracks.size() - 1; i > 0; --i) {
    const int j = QRandomGenerator::global()->bounded(i + 1);
    tracks.swapItemsAt(i, j);
  }

  // Keep the queue pointing at the currently playing track, if present.
  int newIndex = -1;
  for (int i = 0; i < tracks.size(); ++i) {
    const bool idMatches = !m_currentTrack.id.isEmpty() &&
                           tracks[i].id == m_currentTrack.id;
    const bool pathMatches = !m_currentTrack.path.isEmpty() &&
                             tracks[i].path == m_currentTrack.path;
    if (idMatches || pathMatches) {
      newIndex = i;
      break;
    }
  }

  m_queueTracks = tracks;
  if (newIndex != m_queueIndex) {
    m_queueIndex = newIndex;
    emit queueIndexChanged(newIndex);
  }
  emit queueTracksChanged(m_queueTracks);
}

void AppState::queuePlayAll(const QList<TrackData> &tracks) {
  if (tracks.isEmpty())
    return;

  QList<TrackData> toPlay = tracks;
  if (m_shuffleBeforePlayingAll) {
    for (int i = toPlay.size() - 1; i > 0; --i) {
      const int j = QRandomGenerator::global()->bounded(i + 1);
      toPlay.swapItemsAt(i, j);
    }
  }

  m_queueTracks = toPlay;
  emit queueTracksChanged(m_queueTracks);
  m_queueIndex = 0;
  emit queueIndexChanged(0);
  setCurrentTrack(toPlay[0]);
  setIsPlaying(true);
}

void AppState::queueNext() {
  if (m_repeat == RepeatMode::Track) {
    if (!m_currentTrack.id.isEmpty() || !m_currentTrack.path.isEmpty()) {
      setProgress(0.0);
      setIsPlaying(true);
    }
    return;
  }

  int nextIdx = m_queueIndex + 1;
  if (nextIdx >= m_queueTracks.size()) {
    if (m_repeat == RepeatMode::Queue && !m_queueTracks.isEmpty()) {
      nextIdx = 0;
    } else {
      if (m_queueIndex != -1) {
        m_queueIndex = -1;
        emit queueIndexChanged(-1);
      }
      setIsPlaying(false);
      return;
    }
  }

  m_queueIndex = nextIdx;
  setCurrentTrack(m_queueTracks[nextIdx]);
  emit queueIndexChanged(nextIdx);
}

void AppState::queuePrev() {
  const int prevIdx = m_queueIndex - 1;
  if (prevIdx < 0 || prevIdx >= m_queueTracks.size())
    return;
  m_queueIndex = prevIdx;
  setCurrentTrack(m_queueTracks[prevIdx]);
  emit queueIndexChanged(prevIdx);
}

// --- UI ---

LeftTab AppState::leftTab() const { return m_leftTab; }
bool AppState::tracksListCollapsed() const { return m_tracksListCollapsed; }
bool AppState::queueCollapsed() const { return m_queueCollapsed; }
bool AppState::darkMode() const { return m_darkMode; }
bool AppState::showBlurredCover() const { return m_showBlurredCover; }
bool AppState::showOnlyQueueAfterEnqueue() const {
  return m_showOnlyQueueAfterEnqueue;
}
bool AppState::shuffleBeforePlayingAll() const {
  return m_shuffleBeforePlayingAll;
}
bool AppState::showTracksListOnTabChange() const {
  return m_showTracksListOnTabChange;
}
int AppState::searchHistoryLimit() const { return m_searchHistoryLimit; }

void AppState::setLeftTab(LeftTab tab) {
  if (m_leftTab == tab)
    return;
  m_leftTab = tab;
  emit leftTabChanged(tab);
  if (m_showTracksListOnTabChange) {
    setTracksListCollapsed(false);
  }
}

void AppState::setTracksListCollapsed(bool collapsed) {
  if (m_tracksListCollapsed == collapsed)
    return;
  m_tracksListCollapsed = collapsed;
  emit tracksListCollapsedChanged(collapsed);
}

void AppState::setQueueCollapsed(bool collapsed) {
  if (m_queueCollapsed == collapsed)
    return;
  m_queueCollapsed = collapsed;
  emit queueCollapsedChanged(collapsed);
}

void AppState::setDarkMode(bool dark) {
  if (m_darkMode == dark)
    return;
  m_darkMode = dark;
  emit darkModeChanged(dark);
  qDebug() << "darkMode set to" << dark;
}

void AppState::setShowBlurredCover(bool show) {
  if (m_showBlurredCover == show)
    return;
  m_showBlurredCover = show;
  emit showBlurredCoverChanged(show);
}

void AppState::setShowOnlyQueueAfterEnqueue(bool show) {
  if (m_showOnlyQueueAfterEnqueue == show)
    return;
  m_showOnlyQueueAfterEnqueue = show;
  emit showOnlyQueueAfterEnqueueChanged(show);
}

void AppState::setShuffleBeforePlayingAll(bool shuffle) {
  if (m_shuffleBeforePlayingAll == shuffle)
    return;
  m_shuffleBeforePlayingAll = shuffle;
  emit shuffleBeforePlayingAllChanged(shuffle);
}

void AppState::setShowTracksListOnTabChange(bool show) {
  if (m_showTracksListOnTabChange == show)
    return;
  m_showTracksListOnTabChange = show;
  emit showTracksListOnTabChangeChanged(show);
}

void AppState::setSearchHistoryLimit(int limit) {
  if (m_searchHistoryLimit == limit)
    return;
  m_searchHistoryLimit = limit;
  emit searchHistoryLimitChanged(limit);
}

// --- File browser ---

QStringList AppState::fbPath() const { return m_fbPath; }

void AppState::setFbPath(const QStringList &path) {
  if (m_fbPath == path)
    return;
  m_fbPath = path;
  emit fbPathChanged(path);
}

// --- Bookmarks ---

QList<Bookmark> AppState::bookmarks() const { return m_bookmarks; }

void AppState::setBookmarks(const QList<Bookmark> &list) {
  m_bookmarks = list;
  emit bookmarksChanged(list);
}

void AppState::addBookmark(const Bookmark &bm) {
  m_bookmarks.append(bm);
  emit bookmarksChanged(m_bookmarks);
}

void AppState::removeBookmark(int index) {
  if (index < 0 || index >= m_bookmarks.size())
    return;
  m_bookmarks.removeAt(index);
  emit bookmarksChanged(m_bookmarks);
}

// --- Settings ---

double AppState::targetNormalizationDbs() const {
  return m_targetNormalizationDbs;
}
double AppState::maxNormalizationDbs() const { return m_maxNormalizationDbs; }

void AppState::setTargetNormalizationDbs(double db) {
  if (m_targetNormalizationDbs == db)
    return;
  m_targetNormalizationDbs = db;
  emit targetNormalizationDbsChanged(db);
}

void AppState::setMaxNormalizationDbs(double db) {
  if (m_maxNormalizationDbs == db)
    return;
  m_maxNormalizationDbs = db;
  emit maxNormalizationDbsChanged(db);
}

QJsonObject AppState::serverProps() const { return m_serverProps; }

void AppState::setServerProps(const QJsonObject &props) {
  m_serverProps = props;
  emit serverPropsChanged(props);
}

// --- Config persistence ---

void AppState::loadConfig() {
  QSettings settings;
  settings.beginGroup("config");

  setVolume(settings.value("volume", 1.0).toDouble());
  setMuted(settings.value("muted", false).toBool());
  setDarkMode(settings.value("darkMode", false).toBool());
  setShowBlurredCover(settings.value("showBlurredCover", true).toBool());
  setShowOnlyQueueAfterEnqueue(
      settings.value("showOnlyQueueAfterEnqueue", false).toBool());
  setShuffleBeforePlayingAll(
      settings.value("shuffleBeforePlayingAll", true).toBool());
  setShowTracksListOnTabChange(
      settings.value("showTracksListOnTabChange", false).toBool());
  setSearchHistoryLimit(settings.value("searchHistoryLimit", 10).toInt());
  setTargetNormalizationDbs(
      settings.value("targetNormalizationDbs", 0.0).toDouble());
  setMaxNormalizationDbs(settings.value("maxNormalizationDbs", 8.0).toDouble());

  QString sq = settings.value("searchQuery").toString();
  int sql = settings.value("searchLimit", 0).toInt();
  if (!sq.isEmpty())
    setSearchQuery(sq, sql);

  int size = settings.beginReadArray("bookmarks");
  QList<Bookmark> bms;
  for (int i = 0; i < size; i++) {
    settings.setArrayIndex(i);
    Bookmark bm;
    bm.name = settings.value("name").toString();
    bm.query = settings.value("query").toString();
    bms.append(bm);
  }
  settings.endArray();
  if (!bms.isEmpty())
    setBookmarks(bms);

  settings.endGroup();
}

void AppState::saveConfig() {
  QSettings settings;
  settings.beginGroup("config");

  settings.setValue("volume", m_volume);
  settings.setValue("muted", m_muted);
  settings.setValue("darkMode", m_darkMode);
  settings.setValue("showBlurredCover", m_showBlurredCover);
  settings.setValue("showOnlyQueueAfterEnqueue", m_showOnlyQueueAfterEnqueue);
  settings.setValue("shuffleBeforePlayingAll", m_shuffleBeforePlayingAll);
  settings.setValue("showTracksListOnTabChange", m_showTracksListOnTabChange);
  settings.setValue("searchHistoryLimit", m_searchHistoryLimit);
  settings.setValue("targetNormalizationDbs", m_targetNormalizationDbs);
  settings.setValue("maxNormalizationDbs", m_maxNormalizationDbs);
  settings.setValue("searchQuery", m_searchQuery);
  settings.setValue("searchLimit", m_resultLimit);

  settings.beginWriteArray("bookmarks");
  for (int i = 0; i < m_bookmarks.size(); i++) {
    settings.setArrayIndex(i);
    settings.setValue("name", m_bookmarks[i].name);
    settings.setValue("query", m_bookmarks[i].query);
  }
  settings.endArray();

  settings.endGroup();
}