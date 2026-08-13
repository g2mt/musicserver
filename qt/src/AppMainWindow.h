#pragma once

#include <QCompleter>
#include <QFutureWatcher>
#include <QLabel>
#include <QLineEdit>
#include <QMainWindow>
#include <QSplitter>
#include <QStackedWidget>
#include <QTabBar>
#include <QTimer>
#include <QToolBar>

class ApiClient;
class BookmarksWidget;
class FileBrowserWidget;
class SettingsWidget;
class TrackListView;
class NativeAudioPlayer;
class MusicPlayer;

enum class TrackFetchAction { None, PlayAll, AddAll };

class AppMainWindow : public QMainWindow {
  Q_OBJECT
public:
  explicit AppMainWindow(QWidget *parent = nullptr);
  ~AppMainWindow() override;

protected:
  void resizeEvent(QResizeEvent *event) override;
  void setupAudio();

private slots:
  void onSearchSubmit();
  void onTabClicked(int index);
  void refreshSearch();
  void onSearchResultFinished();
  void onPropsResultFinished();
  void playAllTracks();
  void addAllTracks();
  void addVisibleTracks();
  void onTrackFetchFinished();
  void onExternalDownloadFinished();
  void onLoudnessFinished();
  void setTrackSort(const QString &field);

private:
  void setupToolbar();
  void setupLeftPanel();
  void setupRightPanel();
  void setupLayout();
  void setupShortcuts();
  void updateSplitterOrientation();
  void updateWindowTitle(const QString &musicTitle);
  void fetchAllTracks(TrackFetchAction action);
  void updateSearchHistory(const QString &query);
  void startExternalDownload();
  void updateNormalization();

  ApiClient *m_api;
  QSplitter *m_splitter = nullptr;

  // Toolbar
  QToolBar *m_toolbar = nullptr;
  QLineEdit *m_searchInput = nullptr;
  QCompleter *m_searchCompleter = nullptr;
  QAction *m_downloadAction = nullptr;
  QFutureWatcher<QJsonDocument> *m_externalDownloadWatcher = nullptr;
  QFutureWatcher<double> *m_loudnessWatcher = nullptr;
  QString m_loudnessTrackId;
  QString m_externalDownloadPath;
  QString m_externalDownloadUrl;
  bool m_externalDownloadPost = false;

  // Left panel
  QTabBar *m_leftTabBar = nullptr;
  QStackedWidget *m_leftStack = nullptr;
  QWidget *m_tracksTab = nullptr;
  QWidget *m_bookmarksTab = nullptr;
  BookmarksWidget *m_bookmarksWidget = nullptr;
  QWidget *m_filesTab = nullptr;
  FileBrowserWidget *m_fileBrowser = nullptr;
  QWidget *m_settingsTab = nullptr;
  SettingsWidget *m_settingsWidget = nullptr;
  TrackListView *m_trackListView = nullptr;
  QFutureWatcher<QJsonDocument> *m_searchWatcher = nullptr;
  QFutureWatcher<QJsonDocument> *m_propsWatcher = nullptr;

  // Right panel (queue)
  QWidget *m_rightPanel = nullptr;
  TrackListView *m_queueListView = nullptr;
  QFutureWatcher<QJsonDocument> *m_trackFetchWatcher = nullptr;
  TrackFetchAction m_trackFetchAction = TrackFetchAction::None;

  // Audio
  NativeAudioPlayer *m_audioPlayer = nullptr;

  // Music player bar (placeholder until Phase 3)
  MusicPlayer *m_musicPlayer = nullptr;

  // Progress polling
  QTimer *m_progressTimer = nullptr;
};