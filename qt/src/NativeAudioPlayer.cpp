#include "NativeAudioPlayer.h"

#include <QtMath>
#include <qdebug.h>

NativeAudioPlayer::NativeAudioPlayer(QObject *parent) : QObject(parent) {
  m_player = new QMediaPlayer(this);
  m_audioOutput = new QAudioOutput(this);
  m_player->setAudioOutput(m_audioOutput);

  connect(m_player, &QMediaPlayer::positionChanged, this,
          &NativeAudioPlayer::timeChanged);
  connect(m_player, &QMediaPlayer::durationChanged, this,
          &NativeAudioPlayer::durationChanged);
  connect(m_player, &QMediaPlayer::mediaStatusChanged, this,
          &NativeAudioPlayer::onMediaStatusChanged);
}

void NativeAudioPlayer::setSource(const QString &url) {
  if (m_currentSource == url)
    return;
  qDebug() << "setSource" << url;
  const bool wasPlaying =
      m_player->playbackState() == QMediaPlayer::PlayingState;
  m_currentSource = url;
  m_player->setSource(QUrl(url));
  m_player->setPosition(0);
  applyGain();
  if (wasPlaying)
    m_player->play();
}

void NativeAudioPlayer::play() {
  if (m_player->playbackState() != QMediaPlayer::PlayingState) {
    m_player->play();
  }
}

void NativeAudioPlayer::pause() { m_player->pause(); }

void NativeAudioPlayer::setVolume(float v) {
  m_baseVolume = qBound(0.0f, v, 1.0f);
  applyGain();
}

void NativeAudioPlayer::setAmplification(float dB) {
  m_amplificationDb = dB;
  applyGain();
}

void NativeAudioPlayer::seekTo(qint64 ms) { m_player->setPosition(ms); }

qint64 NativeAudioPlayer::currentTime() const { return m_player->position(); }

void NativeAudioPlayer::onMediaStatusChanged(QMediaPlayer::MediaStatus status) {
  if (status == QMediaPlayer::EndOfMedia ||
      status == QMediaPlayer::InvalidMedia) {
    emit ended();
  }
}

float NativeAudioPlayer::computeGain() const {
  float gain = m_baseVolume;
  if (m_amplificationDb != 0.0f) {
    gain *= qPow(10.0f, m_amplificationDb / 20.0f);
  }
  return gain;
}

void NativeAudioPlayer::applyGain() { m_audioOutput->setVolume(computeGain()); }
