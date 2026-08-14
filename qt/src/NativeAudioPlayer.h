#pragma once

#include <QAudioOutput>
#include <QMediaPlayer>
#include <QObject>

class NativeAudioPlayer : public QObject {
  Q_OBJECT
public:
  explicit NativeAudioPlayer(QObject *parent = nullptr);

  void setSource(const QString &url);
  void play();
  void pause();
  void setVolume(float v);
  void setAmplification(float dB);
  void seekTo(qint64 ms);

  qint64 currentTime() const;

signals:
  void timeChanged(qint64 ms);
  void durationChanged(qint64 ms);
  void ended();

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