#pragma once

#include <QByteArray>
#include <QFutureWatcher>
#include <QLabel>
#include <QPushButton>
#include <QSlider>
#include <QString>
#include <QStringList>
#include <QWidget>

class ApiClient;
#ifdef MS_ENABLE_MPRIS
class Mpris;
#endif

class MusicPlayer : public QWidget {
  Q_OBJECT
public:
  explicit MusicPlayer(QWidget *parent = nullptr);

signals:
  void searchRequested(const QString &query);
  void pathRequested(const QStringList &path);

private slots:
  void onProgressSliderChanged(int value);
  void onVolumeSliderChanged(int value);
  void onPlayPauseClicked();
  void onPrevClicked();
  void onNextClicked();
  void onMuteClicked();
  void onRepeatClicked();
  void updateProgressFromState(double secs);
  void updateDurationFromState(double secs);
  void updateTrackFromState(const struct TrackData &track);
  void updatePlayingFromState(bool playing);
  void updateVolumeFromState();
  void updateRepeatFromState();
  void updateQueueNavigation();

private:
  void setupUi();
  void contextMenuEvent(QContextMenuEvent *event) override;

  QSlider *m_progressSlider;
  QSlider *m_volumeSlider;
  QPushButton *m_prevBtn;
  QPushButton *m_playPauseBtn;
  QPushButton *m_nextBtn;
  QPushButton *m_muteBtn;
  QPushButton *m_repeatBtn;
  QLabel *m_trackCover;
  QLabel *m_trackLabel;
  QLabel *m_artistLabel;

  ApiClient *m_api = nullptr;
  QFutureWatcher<QByteArray> *m_coverWatcher = nullptr;
#ifdef MS_ENABLE_MPRIS
  Mpris *m_mpris = nullptr;
#endif

  bool m_seeking = false;
};