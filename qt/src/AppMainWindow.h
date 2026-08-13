#pragma once

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
  void setTrackSort(const QString &field);

private:
  void setupToolbar();
  void setupLeftPanel();
  void setupRightPanel();
  void setupLayout();
  void setupShortcuts();
  void updateSplitterOrientation();
  void fetchAllTracks(TrackFetchAction action);

  ApiClient *m_api;
  QSplitter *m_splitter = nullptr;

  // Toolbar
  QToolBar *m_toolbar = nullptr;
  QLineEdit *m_searchInput = nullptr;

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
  QWidget *m_musicPlayer = nullptr;

  // Progress polling
  QTimer *m_progressTimer = nullptr;
};