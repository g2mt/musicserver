#pragma once

#include <QAudioOutput>
#include <QMediaPlayer>
#include <QObject>

class QtAudioPlayer : public QObject {
  Q_OBJECT
public:
  explicit QtAudioPlayer(QObject *parent = nullptr);

  void setSource(const QString &url);
  void play();
  void pause();
  void setVolume(float v);
  void setAmplification(float dB);
  void seekTo(qint64 ms);

  qint64 currentTime() const;
  qint64 duration() const;
  bool isPlaying() const;

signals:
  void timeChanged(qint64 ms);
  void durationChanged(qint64 ms);
  void ended();
  void playingChanged(bool playing);

private slots:
  void onMediaStatusChanged(QMediaPlayer::MediaStatus status);

private:
  QMediaPlayer *m_player;
  QAudioOutput *m_audioOutput;
  float m_amplificationDb = 0.0f;
  float m_baseVolume = 1.0f;
  QString m_currentSource;

  float computeGain() const;
  void applyGain();
};