#pragma once

#include <QFutureWatcher>
#include <QLabel>
#include <QLineEdit>
#include <QListView>
#include <QMainWindow>
#include <QSplitter>
#include <QStackedWidget>
#include <QTabBar>
#include <QTimer>
#include <QToolBar>

class ApiClient;
class TrackDelegate;
class TrackListModel;
class QtAudioPlayer;
class MusicPlayer;

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
  void onCollapseTracksList();
  void onCollapseQueue();
  void refreshSearch();
  void onSearchResultFinished();
  void onPropsResultFinished();

private:
  void setupToolbar();
  void setupLeftPanel();
  void setupRightPanel();
  void setupLayout();
  void setupShortcuts();
  void updateSplitterOrientation();

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
  QWidget *m_filesTab = nullptr;
  QWidget *m_settingsTab = nullptr;
  QListView *m_trackListView = nullptr;
  TrackListModel *m_trackListModel = nullptr;
  TrackDelegate *m_trackDelegate = nullptr;
  QFutureWatcher<QJsonDocument> *m_searchWatcher = nullptr;
  QFutureWatcher<QJsonDocument> *m_propsWatcher = nullptr;

  // Right panel (queue)
  QWidget *m_rightPanel = nullptr;
  QTabBar *m_rightTabBar = nullptr;
  QListView *m_queueListView = nullptr;
  TrackListModel *m_queueListModel = nullptr;

  // Audio
  QtAudioPlayer *m_audioPlayer = nullptr;

  // Music player bar (placeholder until Phase 3)
  QWidget *m_musicPlayer = nullptr;

  // Progress polling
  QTimer *m_progressTimer = nullptr;
};