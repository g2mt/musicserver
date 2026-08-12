#pragma once

#include <QWidget>
#include <QSlider>
#include <QPushButton>
#include <QLabel>

class MusicPlayer : public QWidget {
	Q_OBJECT
public:
	explicit MusicPlayer(QWidget *parent = nullptr);

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
	QLabel *m_badgeLabel;

	bool m_seeking = false;
};