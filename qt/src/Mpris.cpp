#include "Mpris.h"

#ifdef MS_ENABLE_MPRIS

#include "AppState.h"
#include "TrackData.h"

#include <QCoreApplication>
#include <QDBusAbstractAdaptor>
#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusObjectPath>
#include <QDir>
#include <QUrl>

namespace {

QString mprisTrackPath(const TrackData &track) {
  const QString trackId = track.id.isEmpty() ? track.path : track.id;
  QString path = "/org/mpris/MediaPlayer2/track/";
  for (const QChar character : trackId) {
    const bool valid = (character >= 'a' && character <= 'z') ||
                       (character >= 'A' && character <= 'Z') ||
                       (character >= '0' && character <= '9') ||
                       character == '_';
    path += valid ? character : '_';
  }
  return path;
}

void emitMprisPropertyChanged(const char *interfaceName,
                              const QString &propertyName,
                              const QVariant &value) {
  QDBusMessage message = QDBusMessage::createSignal(
      "/org/mpris/MediaPlayer2", "org.freedesktop.DBus.Properties",
      "PropertiesChanged");
  QVariantMap changed;
  changed.insert(propertyName, value);
  message << QString::fromUtf8(interfaceName) << changed << QStringList();
  QDBusConnection::sessionBus().send(message);
}

class MprisRootAdaptor : public QDBusAbstractAdaptor {
  Q_OBJECT
  Q_CLASSINFO("D-Bus Interface", "org.mpris.MediaPlayer2")
  Q_PROPERTY(bool CanQuit READ canQuit)
  Q_PROPERTY(bool CanRaise READ canRaise)
  Q_PROPERTY(QString DesktopEntry READ desktopEntry)
  Q_PROPERTY(bool HasTrackList READ hasTrackList)
  Q_PROPERTY(QString Identity READ identity)
  Q_PROPERTY(QStringList SupportedMimeTypes READ supportedMimeTypes)
  Q_PROPERTY(QStringList SupportedUriSchemes READ supportedUriSchemes)

public:
  explicit MprisRootAdaptor(QObject *parent) : QDBusAbstractAdaptor(parent) {}

  bool canQuit() const { return true; }
  bool canRaise() const { return false; }
  QString desktopEntry() const { return "musicserver-qt"; }
  bool hasTrackList() const { return false; }
  QString identity() const { return "Music Server"; }
  QStringList supportedMimeTypes() const { return {"audio/*"}; }
  QStringList supportedUriSchemes() const { return {"file"}; }

public slots:
  void Raise() {}
  void Quit() { QCoreApplication::quit(); }
};

class MprisPlayerAdaptor : public QDBusAbstractAdaptor {
  Q_OBJECT
  Q_CLASSINFO("D-Bus Interface", "org.mpris.MediaPlayer2.Player")
  Q_PROPERTY(bool CanControl READ canControl)
  Q_PROPERTY(bool CanGoNext READ canGoNext)
  Q_PROPERTY(bool CanGoPrevious READ canGoPrevious)
  Q_PROPERTY(bool CanPause READ canPause)
  Q_PROPERTY(bool CanPlay READ canPlay)
  Q_PROPERTY(bool CanSeek READ canSeek)
  Q_PROPERTY(QString LoopStatus READ loopStatus WRITE setLoopStatus)
  Q_PROPERTY(QVariantMap Metadata READ metadata)
  Q_PROPERTY(double MinimumRate READ minimumRate)
  Q_PROPERTY(double MaximumRate READ maximumRate)
  Q_PROPERTY(qint64 Position READ position)
  Q_PROPERTY(QString PlaybackStatus READ playbackStatus)
  Q_PROPERTY(double Rate READ rate)
  Q_PROPERTY(bool Shuffle READ shuffle WRITE setShuffle)
  Q_PROPERTY(double Volume READ volume WRITE setVolume)

public:
  explicit MprisPlayerAdaptor(QObject *parent) : QDBusAbstractAdaptor(parent) {
    AppState *state = AppState::instance();

    connect(state, &AppState::progressChanged, this,
            [this](double) { propertyChanged("Position", position()); });
    connect(state, &AppState::durationChanged, this, [this](double) {
      propertyChanged("Metadata", metadata());
      propertyChanged("CanSeek", canSeek());
    });
    connect(state, &AppState::currentTrackChanged, this,
            [this](const TrackData &) {
              propertyChanged("Metadata", metadata());
              propertyChanged("CanPlay", canPlay());
              propertyChanged("CanPause", canPause());
              propertyChanged("CanSeek", canSeek());
              propertyChanged("CanGoNext", canGoNext());
              propertyChanged("CanGoPrevious", canGoPrevious());
            });
    connect(state, &AppState::isPlayingChanged, this, [this](bool) {
      propertyChanged("PlaybackStatus", playbackStatus());
      propertyChanged("CanPlay", canPlay());
      propertyChanged("CanPause", canPause());
    });
    connect(state, &AppState::volumeChanged, this,
            [this](double) { propertyChanged("Volume", volume()); });
    connect(state, &AppState::mutedChanged, this,
            [this](bool) { propertyChanged("Volume", volume()); });
    connect(state, &AppState::repeatChanged, this,
            [this](RepeatMode) { propertyChanged("LoopStatus", loopStatus()); });
    connect(state, &AppState::shuffleBeforePlayingAllChanged, this,
            [this](bool) { propertyChanged("Shuffle", shuffle()); });
    connect(state, &AppState::queueTracksChanged, this,
            [this](const QList<TrackData> &) { updateNavigationProperties(); });
    connect(state, &AppState::queueTracksAdded, this,
            [this](const QList<TrackData> &, int) { updateNavigationProperties(); });
    connect(state, &AppState::queueTracksRemoved, this,
            [this](int, int) { updateNavigationProperties(); });
    connect(state, &AppState::queueIndexChanged, this,
            [this](int) { updateNavigationProperties(); });
  }

  bool canControl() const { return true; }
  bool canGoNext() const { return AppState::instance()->canNext(); }
  bool canGoPrevious() const { return AppState::instance()->canPrev(); }
  bool canPause() const { return hasTrack(); }
  bool canPlay() const { return hasTrack(); }
  bool canSeek() const { return AppState::instance()->duration() > 0.0; }

  QString loopStatus() const {
    switch (AppState::instance()->repeat()) {
    case RepeatMode::Track:
      return "Track";
    case RepeatMode::Queue:
      return "Playlist";
    case RepeatMode::None:
      return "None";
    }
    return "None";
  }

  QVariantMap metadata() const {
    AppState *state = AppState::instance();
    const TrackData &track = *state->currentTrack();
    QVariantMap result;
    if (track.id.isEmpty() && track.path.isEmpty())
      return result;

    result.insert("mpris:trackid",
                  QVariant::fromValue(QDBusObjectPath(mprisTrackPath(track))));
    if (!track.name.isEmpty())
      result.insert("xesam:title", track.name);
    if (!track.artist.isEmpty())
      result.insert("xesam:artist", QStringList{track.artist});
    if (!track.album.isEmpty())
      result.insert("xesam:album", track.album);

    if (state->duration() > 0.0)
      result.insert("mpris:length", positionInMicroseconds(state->duration()));

    const QJsonObject config = state->serverProps()["config"].toObject();
    const QString dataPath = config["data_path"].toString();
    if (!dataPath.isEmpty()) {
      if (!track.path.isEmpty()) {
        result.insert("xesam:url",
                      QUrl::fromLocalFile(QDir(dataPath).filePath(track.path))
                          .toString());
      }
      if (!track.thumbnailPath.isEmpty()) {
        result.insert(
            "mpris:artUrl",
            QUrl::fromLocalFile(QDir(dataPath).filePath(track.thumbnailPath))
                .toString());
      }
    }
    return result;
  }

  double minimumRate() const { return 1.0; }
  double maximumRate() const { return 1.0; }
  qint64 position() const {
    return positionInMicroseconds(AppState::instance()->progress());
  }
  QString playbackStatus() const {
    AppState *state = AppState::instance();
    if (!hasTrack())
      return "Stopped";
    return state->isPlaying() ? "Playing" : "Paused";
  }
  double rate() const { return 1.0; }
  bool shuffle() const {
    return AppState::instance()->shuffleBeforePlayingAll();
  }
  double volume() const {
    AppState *state = AppState::instance();
    return state->muted() ? 0.0 : state->volume();
  }

public slots:
  void Next() { AppState::instance()->queueNext(); }
  void Previous() { AppState::instance()->queuePrev(); }
  void Pause() { AppState::instance()->setIsPlaying(false); }
  void Play() {
    if (hasTrack())
      AppState::instance()->setIsPlaying(true);
  }
  void PlayPause() {
    AppState *state = AppState::instance();
    if (hasTrack())
      state->setIsPlaying(!state->isPlaying());
  }
  void Stop() {
    AppState *state = AppState::instance();
    state->setIsPlaying(false);
    state->setProgress(0.0);
  }
  void Seek(qint64 offset) {
    const qint64 target = boundedPosition(position() + offset);
    AppState::instance()->setProgress(target / 1000000.0);
    emit Seeked(target);
  }
  void SetPosition(const QDBusObjectPath &trackId, qint64 newPosition) {
    if (!hasTrack() || trackId.path() != currentTrackPath())
      return;
    const qint64 target = boundedPosition(newPosition);
    AppState::instance()->setProgress(target / 1000000.0);
    emit Seeked(target);
  }
  void setLoopStatus(const QString &status) {
    AppState *state = AppState::instance();
    if (status == "None")
      state->setRepeat(RepeatMode::None);
    else if (status == "Track")
      state->setRepeat(RepeatMode::Track);
    else if (status == "Playlist")
      state->setRepeat(RepeatMode::Queue);
  }
  void setShuffle(bool enabled) {
    AppState::instance()->setShuffleBeforePlayingAll(enabled);
  }
  void setVolume(double value) {
    AppState *state = AppState::instance();
    state->setVolume(qBound(0.0, value, 1.0));
    state->setMuted(false);
  }

signals:
  void Seeked(qint64 position);

private:
  static qint64 positionInMicroseconds(double seconds) {
    return static_cast<qint64>(seconds * 1000000.0);
  }

  bool hasTrack() const {
    const TrackData &track = *AppState::instance()->currentTrack();
    return !track.id.isEmpty() || !track.path.isEmpty();
  }

  QString currentTrackPath() const {
    return mprisTrackPath(*AppState::instance()->currentTrack());
  }

  qint64 boundedPosition(qint64 value) const {
    const qint64 duration =
        positionInMicroseconds(AppState::instance()->duration());
    return qBound<qint64>(0, value, qMax<qint64>(0, duration));
  }

  void propertyChanged(const QString &name, const QVariant &value) {
    emitMprisPropertyChanged("org.mpris.MediaPlayer2.Player", name, value);
  }

  void updateNavigationProperties() {
    propertyChanged("CanGoNext", canGoNext());
    propertyChanged("CanGoPrevious", canGoPrevious());
  }
};

} // namespace

Mpris::Mpris(QObject *parent) : QObject(parent) {
  QDBusConnection bus = QDBusConnection::sessionBus();
  if (!bus.isConnected())
    return;

  bus.registerService("org.mpris.MediaPlayer2.musicserver_qt");
  new MprisRootAdaptor(this);
  new MprisPlayerAdaptor(this);
  bus.registerObject("/org/mpris/MediaPlayer2", this,
                     QDBusConnection::ExportAdaptors);
}

#include "Mpris.moc"

#endif
