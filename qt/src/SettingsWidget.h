#pragma once

#include <QFutureWatcher>
#include <QJsonObject>
#include <QString>
#include <QWidget>

class ApiClient;
class QCheckBox;
class QGroupBox;
class QLabel;
class QLineEdit;
class QPushButton;
class QSlider;
class QSpinBox;
class ProgressWidget;

class SettingsWidget : public QWidget {
  Q_OBJECT
public:
  explicit SettingsWidget(QWidget *parent = nullptr);

signals:
  void statusMessage(const QString &message);
  void rescanCompleted();

private slots:
  void onSaveClicked();
  void onRescanClicked(bool force);
  void onRescanFinished();
  void updateFromState();
  void updateServerProps(const QJsonObject &props);

private:
  void setupUi();
  QGroupBox *makeSection(const QString &title, QWidget **bodyOut);
  QWidget *makeSliderRow(const QString &label, int min, int max,
                         QSlider **sliderOut, QLabel **valueOut);

  ApiClient *m_api = nullptr;
  QFutureWatcher<void> *m_scanWatcher = nullptr;
  ProgressWidget *m_progressWidget = nullptr;

  // Playback
  QSlider *m_amplificationSlider = nullptr;
  QLabel *m_amplificationValue = nullptr;
  QCheckBox *m_normalizeCheck = nullptr;

  // General settings
  QCheckBox *m_shuffleBeforePlayingAllCheck = nullptr;
  QSlider *m_targetNormalizationSlider = nullptr;
  QLabel *m_targetNormalizationValue = nullptr;
  QSlider *m_maxNormalizationSlider = nullptr;
  QLabel *m_maxNormalizationValue = nullptr;
  QSpinBox *m_searchHistoryLimitSpin = nullptr;
  QCheckBox *m_darkModeCheck = nullptr;
  QPushButton *m_saveButton = nullptr;
  QPushButton *m_rescanButton = nullptr;
  QPushButton *m_forceRescanButton = nullptr;

  // Server properties
  QLineEdit *m_versionEdit = nullptr;
  QLineEdit *m_httpBindEdit = nullptr;
  QLineEdit *m_ipcEnabledEdit = nullptr;
  QLineEdit *m_ipcPathEdit = nullptr;
  QLineEdit *m_dataPathEdit = nullptr;
  QLineEdit *m_dbDirEdit = nullptr;
  QLineEdit *m_cacheDbEnabledEdit = nullptr;
  QLineEdit *m_coverCacheMaxBytesEdit = nullptr;
  QLineEdit *m_mediaDownloaderEdit = nullptr;
};
