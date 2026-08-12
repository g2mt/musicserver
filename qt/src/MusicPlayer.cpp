#include "MusicPlayer.h"
#include "ApiClient.h"
#include "AppState.h"
#include "TrackData.h"

#include <QContextMenuEvent>
#include <QHBoxLayout>
#include <QMenu>
#include <QPixmap>
#include <QVBoxLayout>

MusicPlayer::MusicPlayer(QWidget *parent)
    : QWidget(parent), m_api(ApiClient::instance()) {
  setupUi();

  m_coverWatcher = new QFutureWatcher<QByteArray>(this);
  connect(m_coverWatcher, &QFutureWatcher<QByteArray>::finished, this,
          [this]() {
            QByteArray bytes = m_coverWatcher->result();
            QPixmap pix;
            if (!bytes.isEmpty() && pix.loadFromData(bytes)) {
              m_trackCover->setPixmap(pix.scaled(
                  48, 48, Qt::KeepAspectRatio, Qt::SmoothTransformation));
            } else {
              m_trackCover->setText("?");
            }
          });

  AppState *state = AppState::instance();

  connect(state, &AppState::progressChanged, this,
          &MusicPlayer::updateProgressFromState);
  connect(state, &AppState::durationChanged, this,
          &MusicPlayer::updateDurationFromState);
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
}

void MusicPlayer::setupUi() {
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
  m_prevBtn = new QPushButton("|<");
  m_prevBtn->setFixedWidth(32);
  m_playPauseBtn = new QPushButton(">");
  m_playPauseBtn->setFixedWidth(32);
  m_nextBtn = new QPushButton(">|");
  m_nextBtn->setFixedWidth(32);

  controlsLayout->addWidget(m_prevBtn);
  controlsLayout->addWidget(m_playPauseBtn);
  controlsLayout->addWidget(m_nextBtn);

  // Center: track info
  controlsLayout->addStretch();

  QWidget *trackInfo = new QWidget();
  QHBoxLayout *trackLayout = new QHBoxLayout(trackInfo);
  trackLayout->setContentsMargins(0, 0, 0, 0);

  m_trackCover = new QLabel();
  m_trackCover->setFixedSize(48, 48);
  m_trackCover->setAlignment(Qt::AlignCenter);
  m_trackCover->setStyleSheet("border: 1px solid gray;");

  m_trackLabel = new QLabel("No track playing");
  m_trackLabel->setAlignment(Qt::AlignLeft | Qt::AlignVCenter);

  m_badgeLabel = new QLabel();
  m_badgeLabel->setStyleSheet(
      "background: blue; color: white; border-radius: 4px; "
      "padding: 1px 4px; font-size: xx-small;");
  m_badgeLabel->hide();

  trackLayout->addWidget(m_trackCover);
  trackLayout->addWidget(m_trackLabel);
  trackLayout->addWidget(m_badgeLabel);

  controlsLayout->addWidget(trackInfo);
  controlsLayout->addStretch();

  // Right: volume slider, mute, repeat
  m_volumeSlider = new QSlider(Qt::Horizontal);
  m_volumeSlider->setRange(0, 100);
  m_volumeSlider->setValue(100);
  m_volumeSlider->setFixedWidth(80);

  m_muteBtn = new QPushButton("Vol");
  m_muteBtn->setFixedWidth(32);

  m_repeatBtn = new QPushButton("R");
  m_repeatBtn->setFixedWidth(32);

  controlsLayout->addWidget(m_volumeSlider);
  controlsLayout->addWidget(m_muteBtn);
  controlsLayout->addWidget(m_repeatBtn);

  mainLayout->addLayout(controlsLayout);

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

void MusicPlayer::onProgressSliderChanged(int value) {
  if (!m_seeking)
    return;
  AppState *state = AppState::instance();
  double dur = state->duration();
  if (dur > 0)
    state->setProgress(value / 1000.0 * dur);
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

void MusicPlayer::updateDurationFromState(double) {
  // Duration handled implicitly by progress-to-slider ratio
}

void MusicPlayer::updateTrackFromState(const TrackData &track) {
  m_trackLabel->setText(track.name);
  m_trackCover->clear();
  m_trackCover->setText("?");
  if (!m_api || track.id.isEmpty()) {
    return;
  }
  m_coverWatcher->setFuture(
      m_api->getBytes(QString("/track/%1/cover").arg(track.id)));
}

void MusicPlayer::updatePlayingFromState(bool playing) {
  m_playPauseBtn->setText(playing ? "||" : ">");
}

void MusicPlayer::updateVolumeFromState() {
  AppState *state = AppState::instance();
  if (state->muted()) {
    m_volumeSlider->setValue(0);
  } else {
    m_volumeSlider->setValue(static_cast<int>(state->volume() * 100));
  }
}

void MusicPlayer::updateRepeatFromState() {
  AppState *state = AppState::instance();
  switch (state->repeat()) {
  case RepeatMode::None:
    m_repeatBtn->setText("R");
    m_badgeLabel->hide();
    break;
  case RepeatMode::Track:
    m_repeatBtn->setText("R");
    m_badgeLabel->setText("Track");
    m_badgeLabel->show();
    break;
  case RepeatMode::Queue:
    m_repeatBtn->setText("R");
    m_badgeLabel->setText("Queue");
    m_badgeLabel->show();
    break;
  }
}

void MusicPlayer::contextMenuEvent(QContextMenuEvent *event) {
  AppState *state = AppState::instance();

  QMenu menu(this);

  QAction *playAction = menu.addAction(state->isPlaying() ? "Pause" : "Play");
  connect(playAction, &QAction::triggered, this,
          &MusicPlayer::onPlayPauseClicked);

  if (state->queueIndex() + 1 < state->queueTracks().size() ||
      state->repeat() != RepeatMode::None) {
    menu.addAction("Next")->setEnabled(true);
  } else {
    menu.addAction("Next")->setEnabled(false);
  }

  if (state->queueIndex() > 0) {
    menu.addAction("Previous")->setEnabled(true);
  } else {
    menu.addAction("Previous")->setEnabled(false);
  }

  menu.addSeparator()->setText("Repeat...");

  QAction *repeatTrack = menu.addAction("Track");
  repeatTrack->setCheckable(true);
  repeatTrack->setChecked(state->repeat() == RepeatMode::Track);

  QAction *repeatQueue = menu.addAction("Queue");
  repeatQueue->setCheckable(true);
  repeatQueue->setChecked(state->repeat() == RepeatMode::Queue);

  QAction *repeatOff = menu.addAction("No repeat");
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