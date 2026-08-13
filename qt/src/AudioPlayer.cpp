#include "AudioPlayer.h"

#include <QtMath>
#include <qdebug.h>

AudioPlayer::AudioPlayer(QObject *parent) : QObject(parent) {
  m_player = new QMediaPlayer(this);
  m_audioOutput = new QAudioOutput(this);
  m_player->setAudioOutput(m_audioOutput);

  connect(m_player, &QMediaPlayer::positionChanged, this,
          &AudioPlayer::timeChanged);
  connect(m_player, &QMediaPlayer::durationChanged, this,
          &AudioPlayer::durationChanged);
  connect(m_player, &QMediaPlayer::mediaStatusChanged, this,
          &AudioPlayer::onMediaStatusChanged);
  connect(m_player, &QMediaPlayer::playbackStateChanged, this,
          [this](QMediaPlayer::PlaybackState state) {
            emit playingChanged(state == QMediaPlayer::PlayingState);
          });
}

void AudioPlayer::setSource(const QString &url) {
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

void AudioPlayer::play() {
  if (m_player->playbackState() != QMediaPlayer::PlayingState) {
    m_player->play();
  }
}

void AudioPlayer::pause() { m_player->pause(); }

void AudioPlayer::setVolume(float v) {
  m_baseVolume = qBound(0.0f, v, 1.0f);
  applyGain();
}

void AudioPlayer::setAmplification(float dB) {
  m_amplificationDb = dB;
  applyGain();
}

void AudioPlayer::seekTo(qint64 ms) { m_player->setPosition(ms); }

qint64 AudioPlayer::currentTime() const { return m_player->position(); }

qint64 AudioPlayer::duration() const { return m_player->duration(); }

bool AudioPlayer::isPlaying() const {
  return m_player->playbackState() == QMediaPlayer::PlayingState;
}

void AudioPlayer::onMediaStatusChanged(QMediaPlayer::MediaStatus status) {
  if (status == QMediaPlayer::EndOfMedia ||
      status == QMediaPlayer::InvalidMedia) {
    emit ended();
  }
}

float AudioPlayer::computeGain() const {
  float gain = m_baseVolume;
  if (m_amplificationDb != 0.0f) {
    gain *= qPow(10.0f, m_amplificationDb / 20.0f);
  }
  return gain;
}

void AudioPlayer::applyGain() { m_audioOutput->setVolume(computeGain()); }
