#include "QtAudioPlayer.h"

#include <QtMath>

QtAudioPlayer::QtAudioPlayer(QObject *parent) : QObject(parent) {
  m_player = new QMediaPlayer(this);
  m_audioOutput = new QAudioOutput(this);
  m_player->setAudioOutput(m_audioOutput);

  connect(m_player, &QMediaPlayer::positionChanged, this,
          &QtAudioPlayer::timeChanged);
  connect(m_player, &QMediaPlayer::durationChanged, this,
          &QtAudioPlayer::durationChanged);
  connect(m_player, &QMediaPlayer::mediaStatusChanged, this,
          &QtAudioPlayer::onMediaStatusChanged);
  connect(m_player, &QMediaPlayer::playbackStateChanged, this,
          [this](QMediaPlayer::PlaybackState state) {
            emit playingChanged(state == QMediaPlayer::PlayingState);
          });
}

void QtAudioPlayer::setSource(const QString &url) {
  if (m_currentSource == url)
    return;
  const bool wasPlaying =
      m_player->playbackState() == QMediaPlayer::PlayingState;
  m_currentSource = url;
  m_player->setSource(QUrl(url));
  m_player->setPosition(0);
  applyGain();
  if (wasPlaying)
    m_player->play();
}

void QtAudioPlayer::play() {
  if (m_player->playbackState() != QMediaPlayer::PlayingState) {
    m_player->play();
  }
}

void QtAudioPlayer::pause() { m_player->pause(); }

void QtAudioPlayer::setVolume(float v) {
  m_baseVolume = qBound(0.0f, v, 1.0f);
  applyGain();
}

void QtAudioPlayer::setAmplification(float dB) {
  m_amplificationDb = dB;
  applyGain();
}

void QtAudioPlayer::seekTo(qint64 ms) { m_player->setPosition(ms); }

qint64 QtAudioPlayer::currentTime() const { return m_player->position(); }

qint64 QtAudioPlayer::duration() const { return m_player->duration(); }

bool QtAudioPlayer::isPlaying() const {
  return m_player->playbackState() == QMediaPlayer::PlayingState;
}

void QtAudioPlayer::onMediaStatusChanged(QMediaPlayer::MediaStatus status) {
  if (status == QMediaPlayer::EndOfMedia) {
    emit ended();
  }
}

float QtAudioPlayer::computeGain() const {
  float gain = m_baseVolume;
  if (m_amplificationDb != 0.0f) {
    gain *= qPow(10.0f, m_amplificationDb / 20.0f);
  }
  return gain;
}

void QtAudioPlayer::applyGain() { m_audioOutput->setVolume(computeGain()); }