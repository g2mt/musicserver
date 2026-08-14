#include "MusicPlayer.h"
#include "ApiClient.h"
#include "AppState.h"
#include "TrackData.h"
#ifdef MS_ENABLE_MPRIS
#include "Mpris.h"
#endif

#include <QContextMenuEvent>
#include <QFont>
#include <QHBoxLayout>
#include <QIcon>
#include <QMenu>
#include <QPainter>
#include <QPixmap>
#include <QStyle>
#include <QVBoxLayout>

MusicPlayer::MusicPlayer(QWidget *parent)
    : QWidget(parent), m_api(ApiClient::instance()) {
#ifdef MS_ENABLE_MPRIS
  m_mpris = new Mpris(this);
#endif

  setupUi();

  m_coverWatcher = new QFutureWatcher<QByteArray>(this);
  connect(m_coverWatcher, &QFutureWatcher<QByteArray>::finished, this,
          [this]() {
            QByteArray bytes = m_coverWatcher->result();
            QPixmap pix;
            if (!bytes.isEmpty() && pix.loadFromData(bytes)) {
              m_trackCover->setPixmap(
                  pix.scaled(m_iconSize, m_iconSize, Qt::KeepAspectRatio,
                             Qt::SmoothTransformation));
            } else {
              m_trackCover->setPixmap(QIcon::fromTheme("audio-x-generic")
                                          .pixmap(m_iconSize, m_iconSize));
            }
#ifdef MS_ENABLE_MPRIS
            m_mpris->setCover(bytes);
#endif
          });

  AppState *state = AppState::instance();

  connect(state, &AppState::progressChanged, this,
          &MusicPlayer::updateProgressFromState);
  connect(state, &AppState::currentTrackChanged, this,
          &MusicPlayer::updateTrackFromState);
  connect(state, &AppState::isPlayingChanged, this,
          &MusicPlayer::updatePlayingFromState);
  connect(state, &AppState::volumeChanged, this,
          &MusicPlayer::updateVolumeFromState);
  connect(state, &AppState::mutedChanged, this,
          &MusicPlayer::updateVolumeFromState);
  connect(state, &AppState::repeatChanged, this,
          &MusicPlayer::updateRepeatFromState);
  connect(state, &AppState::queueTracksChanged, this,
          &MusicPlayer::updateQueueNavigation);
  connect(state, &AppState::queueTracksAdded, this,
          &MusicPlayer::updateQueueNavigation);
  connect(state, &AppState::queueTracksRemoved, this,
          &MusicPlayer::updateQueueNavigation);
  connect(state, &AppState::queueIndexChanged, this,
          &MusicPlayer::updateQueueNavigation);
  connect(state, &AppState::repeatChanged, this,
          &MusicPlayer::updateQueueNavigation);
  connect(state, &AppState::currentTrackChanged, this,
          &MusicPlayer::updateQueueNavigation);

  updateQueueNavigation();
}

void MusicPlayer::setupUi() {
  m_iconSize = style()->pixelMetric(QStyle::PM_LargeIconSize);
  setFixedHeight(100);

  QVBoxLayout *mainLayout = new QVBoxLayout(this);
  mainLayout->setContentsMargins(8, 4, 8, 4);

  // Scrubber bar
  m_progressSlider = new QSlider(Qt::Horizontal);
  m_progressSlider->setRange(0, 1000);
  m_progressSlider->setValue(0);
  mainLayout->addWidget(m_progressSlider);

  // Controls row
  QHBoxLayout *controlsLayout = new QHBoxLayout();
  controlsLayout->setContentsMargins(0, 0, 0, 0);

  // Left: prev, play/pause, next
  m_prevBtn = new QPushButton();
  m_prevBtn->setIcon(QIcon::fromTheme("media-skip-backward"));
  m_prevBtn->setFlat(true);
  m_playPauseBtn = new QPushButton();
  m_playPauseBtn->setIcon(QIcon::fromTheme("media-playback-start"));
  m_playPauseBtn->setFlat(true);
  m_nextBtn = new QPushButton();
  m_nextBtn->setIcon(QIcon::fromTheme("media-skip-forward"));
  m_nextBtn->setFlat(true);

  controlsLayout->addWidget(m_prevBtn);
  controlsLayout->addWidget(m_playPauseBtn);
  controlsLayout->addWidget(m_nextBtn);

  // Center: track info
  controlsLayout->addStretch();

  QWidget *trackInfo = new QWidget();
  QHBoxLayout *trackLayout = new QHBoxLayout(trackInfo);
  trackLayout->setContentsMargins(0, 0, 0, 0);

  m_trackCover = new QLabel();
  m_trackCover->setFixedSize(m_iconSize, m_iconSize);
  m_trackCover->setAlignment(Qt::AlignCenter);
  m_trackCover->setStyleSheet("border: 1px solid gray;");

  m_trackLabel = new QLabel("No track playing");

  m_artistLabel = new QLabel();
  m_artistLabel->setStyleSheet("color: gray;");

  QWidget *titleBox = new QWidget();
  QVBoxLayout *titleLayout = new QVBoxLayout(titleBox);
  titleLayout->setContentsMargins(0, 0, 0, 0);
  titleLayout->setSpacing(0);
  titleLayout->addWidget(m_trackLabel);
  titleLayout->addWidget(m_artistLabel);

  trackLayout->addWidget(m_trackCover);
  trackLayout->addWidget(titleBox);

  controlsLayout->addWidget(trackInfo);
  controlsLayout->addStretch();

  // Right: volume slider, mute, repeat
  m_volumeSlider = new QSlider(Qt::Horizontal);
  m_volumeSlider->setRange(0, 100);
  m_volumeSlider->setValue(100);
  m_volumeSlider->setFixedWidth(80);

  m_muteBtn = new QPushButton();
  m_muteBtn->setIcon(QIcon::fromTheme("audio-volume-high"));
  m_muteBtn->setFlat(true);

  m_repeatBtn = new QPushButton();
  m_repeatBtn->setIcon(QIcon::fromTheme("media-repeat-all"));
  m_repeatBtn->setCheckable(true);
  m_repeatBtn->setFlat(true);

  controlsLayout->addWidget(m_volumeSlider);
  controlsLayout->addWidget(m_muteBtn);
  controlsLayout->addWidget(m_repeatBtn);

  mainLayout->addLayout(controlsLayout);

  updateTrackFromState(TrackData());
  updateRepeatFromState();

  // Connections
  connect(m_progressSlider, &QSlider::sliderPressed, this,
          [this]() { m_seeking = true; });
  connect(m_progressSlider, &QSlider::sliderReleased, this, [this]() {
    m_seeking = false;
    AppState::instance()->setProgress(m_progressSlider->value() / 1000.0 *
                                      AppState::instance()->duration());
  });
  connect(m_volumeSlider, &QSlider::valueChanged, this,
          &MusicPlayer::onVolumeSliderChanged);
  connect(m_playPauseBtn, &QPushButton::clicked, this,
          &MusicPlayer::onPlayPauseClicked);
  connect(m_prevBtn, &QPushButton::clicked, this, &MusicPlayer::onPrevClicked);
  connect(m_nextBtn, &QPushButton::clicked, this, &MusicPlayer::onNextClicked);
  connect(m_muteBtn, &QPushButton::clicked, this, &MusicPlayer::onMuteClicked);
  connect(m_repeatBtn, &QPushButton::clicked, this,
          &MusicPlayer::onRepeatClicked);
}

void MusicPlayer::onVolumeSliderChanged(int value) {
  AppState *state = AppState::instance();
  state->setVolume(value / 100.0);
  state->setMuted(false);
}

void MusicPlayer::onPlayPauseClicked() {
  AppState *state = AppState::instance();
  state->setIsPlaying(!state->isPlaying());
}

void MusicPlayer::onPrevClicked() { AppState::instance()->queuePrev(); }

void MusicPlayer::onNextClicked() { AppState::instance()->queueNext(); }

void MusicPlayer::onMuteClicked() {
  AppState *state = AppState::instance();
  state->setMuted(!state->muted());
}

void MusicPlayer::onRepeatClicked() {
  AppState *state = AppState::instance();
  switch (state->repeat()) {
  case RepeatMode::None:
    state->setRepeat(RepeatMode::Track);
    break;
  case RepeatMode::Track:
    state->setRepeat(RepeatMode::Queue);
    break;
  case RepeatMode::Queue:
    state->setRepeat(RepeatMode::None);
    break;
  }
}

void MusicPlayer::updateProgressFromState(double secs) {
  if (m_seeking)
    return;
  AppState *state = AppState::instance();
  if (state->duration() > 0) {
    m_progressSlider->setValue(
        static_cast<int>(secs / state->duration() * 1000));
  }
}

void MusicPlayer::updateTrackFromState(const TrackData &track) {
#ifdef MS_ENABLE_MPRIS
  m_mpris->setCover(QByteArray());
#endif
  QFont titleFont = m_trackLabel->font();
  if (track.name.isEmpty()) {
    m_trackLabel->setText("No track playing");
    titleFont.setBold(false);
    m_artistLabel->hide();
  } else {
    m_trackLabel->setText(track.name);
    titleFont.setBold(true);
    if (track.artist.isEmpty()) {
      m_artistLabel->hide();
    } else {
      m_artistLabel->setText(track.artist);
      m_artistLabel->show();
    }
  }
  m_trackLabel->setFont(titleFont);
  m_trackCover->clear();
  m_trackCover->setPixmap(
      QIcon::fromTheme("audio-x-generic").pixmap(m_iconSize, m_iconSize));
  if (!m_api || track.id.isEmpty()) {
    return;
  }
  m_coverWatcher->setFuture(
      m_api->getBytes(QString("/track/%1/cover").arg(track.id)));
}

void MusicPlayer::updatePlayingFromState(bool playing) {
  m_playPauseBtn->setIcon(QIcon::fromTheme(playing ? "media-playback-pause"
                                                   : "media-playback-start"));
}

void MusicPlayer::updateVolumeFromState() {
  AppState *state = AppState::instance();
  if (state->muted()) {
    m_volumeSlider->setValue(0);
    m_muteBtn->setIcon(QIcon::fromTheme("audio-volume-muted"));
  } else {
    m_volumeSlider->setValue(static_cast<int>(state->volume() * 100));
    m_muteBtn->setIcon(QIcon::fromTheme("audio-volume-high"));
  }
}

void MusicPlayer::updateRepeatFromState() {
  AppState *state = AppState::instance();
  RepeatMode repeat = state->repeat();
  QString tooltip;
  switch (repeat) {
  case RepeatMode::None:
    tooltip = "No Repeat";
    break;
  case RepeatMode::Track:
    tooltip = "Repeat Track";
    break;
  case RepeatMode::Queue:
    tooltip = "Repeat Queue";
    break;
  }

  QIcon baseIcon = QIcon::fromTheme("media-repeat-all");
  QSize iconSize(m_iconSize, m_iconSize);
  const int badgeRadius = m_iconSize / 2;
  QPixmap icon = baseIcon.pixmap(iconSize);
  if (repeat != RepeatMode::None) {
    QPainter painter(&icon);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setPen(QPen(Qt::white, 1));
    painter.setBrush(QColor("#2196f3"));
    painter.drawEllipse(iconSize.width() - badgeRadius, iconSize.height() - badgeRadius, badgeRadius, badgeRadius);
  }
  m_repeatBtn->setIcon(QIcon(icon));
  m_repeatBtn->setChecked(repeat != RepeatMode::None);
  m_repeatBtn->setToolTip(tooltip);
}

void MusicPlayer::updateQueueNavigation() {
  AppState *state = AppState::instance();
  m_prevBtn->setEnabled(state->canPrev());
  m_nextBtn->setEnabled(state->canNext());
}

void MusicPlayer::contextMenuEvent(QContextMenuEvent *event) {
  AppState *state = AppState::instance();

  QMenu menu(this);

  QAction *playAction = menu.addAction(
      QIcon::fromTheme(state->isPlaying() ? "media-playback-pause"
                                          : "media-playback-start"),
      state->isPlaying() ? "Pause" : "Play");
  connect(playAction, &QAction::triggered, this,
          &MusicPlayer::onPlayPauseClicked);

  QAction *nextAction =
      menu.addAction(QIcon::fromTheme("media-skip-forward"), "Next");
  nextAction->setEnabled(state->canNext());

  QAction *prevAction =
      menu.addAction(QIcon::fromTheme("media-skip-backward"), "Previous");
  prevAction->setEnabled(state->canPrev());

  const TrackData track = *state->currentTrack();
  if (!track.name.isEmpty()) {
    QMenu *goToMenu = menu.addMenu("Go to...");
    if (!track.album.isEmpty()) {
      goToMenu->addAction(
          QIcon::fromTheme("media-optical"), "Album", this, [this, track]() {
            AppState::instance()->setSearchQuery(
                QString("album:\"%1\"").arg(track.album));
          });
    }
    if (!track.artist.isEmpty()) {
      goToMenu->addAction(
          QIcon::fromTheme("user-identity"), "Artist", this, [this, track]() {
            AppState::instance()->setSearchQuery(
                QString("artist:\"%1\"").arg(track.artist));
          });
    }
    goToMenu->addAction(QIcon::fromTheme("folder"), "Path", this,
                        [this, track]() {
                          QStringList parts = track.path.split("/");
                          parts.removeLast();
                          emit pathRequested(parts);
                        });
  }

  menu.addSeparator()->setText("Repeat...");

  QAction *repeatTrack =
      menu.addAction(QIcon::fromTheme("media-repeat-single"), "Track");
  repeatTrack->setCheckable(true);
  repeatTrack->setChecked(state->repeat() == RepeatMode::Track);

  QAction *repeatQueue =
      menu.addAction(QIcon::fromTheme("media-repeat-all"), "Queue");
  repeatQueue->setCheckable(true);
  repeatQueue->setChecked(state->repeat() == RepeatMode::Queue);

  QAction *repeatOff = menu.addAction("No Repeat");
  repeatOff->setCheckable(true);
  repeatOff->setChecked(state->repeat() == RepeatMode::None);

  connect(repeatTrack, &QAction::triggered, this,
          [state]() { state->setRepeat(RepeatMode::Track); });
  connect(repeatQueue, &QAction::triggered, this,
          [state]() { state->setRepeat(RepeatMode::Queue); });
  connect(repeatOff, &QAction::triggered, this,
          [state]() { state->setRepeat(RepeatMode::None); });

  menu.exec(event->globalPos());
}
