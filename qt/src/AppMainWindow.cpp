#include "AppMainWindow.h"
#include "ApiClient.h"
#include "AppState.h"
#include "AudioPlayer.h"
#include "BookmarksWidget.h"
#include "FileBrowserWidget.h"
#include "MusicPlayer.h"
#include "TrackListView.h"

#include <QAction>
#include <QApplication>
#include <QDebug>
#include <QHBoxLayout>
#include <QIcon>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMenu>
#include <QPushButton>
#include <QResizeEvent>
#include <QShortcut>
#include <QSizePolicy>
#include <QStatusBar>
#include <QToolBar>
#include <QUrl>
#include <QVBoxLayout>
#include <QtMath>

static const int COLLAPSE_AT_WIDTH = 800;

AppMainWindow::AppMainWindow(QWidget *parent)
    : QMainWindow(parent), m_api(ApiClient::instance()) {
  setWindowTitle("Music Server");

  AppState *state = AppState::instance();

  // Create search watcher early (refreshSearch depends on it)
  m_searchWatcher = new QFutureWatcher<QJsonDocument>(this);
  connect(m_searchWatcher, &QFutureWatcher<QJsonDocument>::finished, this,
          &AppMainWindow::onSearchResultFinished);

  m_propsWatcher = new QFutureWatcher<QJsonDocument>(this);
  connect(m_propsWatcher, &QFutureWatcher<QJsonDocument>::finished, this,
          &AppMainWindow::onPropsResultFinished);
  m_propsWatcher->setFuture(m_api->get("/props"));

  m_trackFetchWatcher = new QFutureWatcher<QJsonDocument>(this);
  connect(m_trackFetchWatcher, &QFutureWatcher<QJsonDocument>::finished, this,
          &AppMainWindow::onTrackFetchFinished);

  setupAudio();
  setupToolbar();
  setupLeftPanel();
  setupRightPanel();
  m_musicPlayer = new MusicPlayer();
  setupLayout();
  setupShortcuts();

  // Status bar
  statusBar()->showMessage("Ready");

  // Load config
  state->loadConfig();

  // Initial search to load all tracks on startup
  refreshSearch();

  // Connect state signals
  connect(state, &AppState::currentTrackChanged, this,
          [this, state](const TrackData &track) {
            setWindowTitle(track.name.isEmpty() ? "Music Server" : track.name);
            if (track.id != state->highlightedTrackId())
              state->setHighlightedTrackId(QString());
          });

  connect(state, &AppState::highlightedTrackIdChanged, this,
          [this](const QString &id) {
            m_trackListView->setHighlightedTrackId(id);
          });

  connect(state, &AppState::leftTabChanged, this, [this](LeftTab tab) {
    m_leftStack->setCurrentIndex(static_cast<int>(tab));
    m_leftTabBar->setCurrentIndex(static_cast<int>(tab));
  });

  connect(state, &AppState::tracksListCollapsedChanged, this,
          [this](bool collapsed) { m_leftStack->setVisible(!collapsed); });

  connect(state, &AppState::queueCollapsedChanged, this,
          [this](bool collapsed) { m_queueListView->setVisible(!collapsed); });

  connect(state, &AppState::queueTracksChanged, this,
          [this](const QList<TrackData> &tracks) {
            m_queueListView->setTracks(tracks);
            m_rightPanel->setVisible(!tracks.isEmpty());
          });

  connect(state, &AppState::queueTracksAdded, this,
          [this](const QList<TrackData> &tracks, int startIndex) {
            m_queueListView->insertTracks(tracks, startIndex);
            m_rightPanel->setVisible(true);
          });

  connect(state, &AppState::queueTracksRemoved, this,
          [this, state](int startIndex, int count) {
            m_queueListView->removeTracks(startIndex, count);
            m_rightPanel->setVisible(!state->queueTracks().isEmpty());
          });

  connect(state, &AppState::queueIndexChanged, this, [this, state](int index) {
    const QList<TrackData> tracks = state->queueTracks();
    const QString id =
        (index >= 0 && index < tracks.size()) ? tracks.at(index).id : QString();
    m_queueListView->setHighlightedTrackId(id);
  });

  // Progress timer (replace SSE polling)
  m_progressTimer = new QTimer(this);
  m_progressTimer->setInterval(500);
  m_progressTimer->start();
}

AppMainWindow::~AppMainWindow() { AppState::instance()->saveConfig(); }

void AppMainWindow::setupAudio() {
  AppState *state = AppState::instance();
  m_audioPlayer = new AudioPlayer(this);

  // Player → AppState: sync time, duration, ended
  connect(m_audioPlayer, &AudioPlayer::timeChanged, this,
          [state](qint64 ms) { state->setProgress(ms / 1000.0); });
  connect(m_audioPlayer, &AudioPlayer::durationChanged, this,
          [state](qint64 ms) { state->setDuration(ms / 1000.0); });
  connect(m_audioPlayer, &AudioPlayer::ended, this,
          [state]() { state->queueNext(); });

  // AppState → Player: track changes
  connect(
      state, &AppState::currentTrackChanged, this,
      [this, state](const TrackData &track) {
        if (state->serverProps().isEmpty())
          return;
        QString dataPath =
            state->serverProps()["config"].toObject()["data_path"].toString();
        QString filePath = dataPath;
        if (!dataPath.endsWith("/"))
          filePath += "/";
        filePath += track.path;
        m_audioPlayer->setSource(QUrl::fromLocalFile(filePath).toString());
      });

  // AppState → Player: play/pause
  connect(state, &AppState::isPlayingChanged, this, [this](bool playing) {
    if (playing)
      m_audioPlayer->play();
    else
      m_audioPlayer->pause();
  });

  // AppState → Player: seek
  connect(state, &AppState::progressChanged, this, [this](double secs) {
    qint64 targetMs = static_cast<qint64>(secs * 1000.0);
    if (qAbs(m_audioPlayer->currentTime() - targetMs) > 500) {
      m_audioPlayer->seekTo(targetMs);
    }
  });

  // AppState → Player: volume
  connect(state, &AppState::volumeChanged, this, [this, state]() {
    m_audioPlayer->setVolume(
        state->muted() ? 0.0f : static_cast<float>(state->volume()));
  });
  connect(state, &AppState::mutedChanged, this, [this, state]() {
    m_audioPlayer->setVolume(
        state->muted() ? 0.0f : static_cast<float>(state->volume()));
  });

  // AppState → Player: amplification
  connect(state, &AppState::amplificationChanged, this, [this](double db) {
    m_audioPlayer->setAmplification(static_cast<float>(db));
  });
}

void AppMainWindow::setupToolbar() {
  m_toolbar = addToolBar("Search");
  m_toolbar->setMovable(false);
  m_toolbar->setFloatable(false);
  m_toolbar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);

  QAction *homeAction =
      m_toolbar->addAction(QIcon::fromTheme("go-home"), "Home");
  homeAction->setToolTip("Go to top");
  connect(homeAction, &QAction::triggered, this,
          [this]() { m_trackListView->scrollToTop(); });

  m_searchInput = new QLineEdit();
  m_searchInput->setPlaceholderText("Search tracks...");
  m_searchInput->setClearButtonEnabled(true);
  m_searchInput->setMinimumWidth(200);

  connect(m_searchInput, &QLineEdit::returnPressed, this,
          &AppMainWindow::onSearchSubmit);

  m_toolbar->addWidget(m_searchInput);

  QAction *searchAction =
      m_toolbar->addAction(QIcon::fromTheme("system-search"), "Search");
  connect(searchAction, &QAction::triggered, this,
          &AppMainWindow::onSearchSubmit);
}

void AppMainWindow::setupLeftPanel() {
  m_leftTabBar = new QTabBar();
  m_leftTabBar->addTab(QIcon::fromTheme("audio-x-generic"), "Tracks");
  m_leftTabBar->addTab(QIcon::fromTheme("bookmark-new"), "Bookmarks");
  m_leftTabBar->addTab(QIcon::fromTheme("folder"), "Files");
  m_leftTabBar->addTab(QIcon::fromTheme("preferences-system"), "Settings");

  connect(m_leftTabBar, &QTabBar::currentChanged, this,
          &AppMainWindow::onTabClicked);

  m_leftStack = new QStackedWidget();

  // Tracks tab
  m_tracksTab = new QWidget();
  QVBoxLayout *tracksLayout = new QVBoxLayout(m_tracksTab);
  tracksLayout->setContentsMargins(0, 0, 0, 0);

  m_trackListView = new TrackListView(TrackListView::Action::Enqueue, this);

  connect(m_trackListView, &TrackListView::playRequested, this,
          [this](const TrackData &track, int) {
            AppState *state = AppState::instance();
            state->setHighlightedTrackId(track.id);
            state->setCurrentTrack(track);
            state->setIsPlaying(true);
          });

  connect(m_trackListView, &TrackListView::enqueueRequested, this,
          [this](const TrackData &track) {
            AppState::instance()->queueAdd(track);
          });

  QToolBar *tracksControls = new QToolBar();
  tracksControls->setMovable(false);
  tracksControls->setFloatable(false);
  tracksControls->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
  tracksControls->setContextMenuPolicy(Qt::CustomContextMenu);

  QAction *playAllAction = tracksControls->addAction(
      QIcon::fromTheme("media-playback-start"), "Play all");
  connect(playAllAction, &QAction::triggered, this,
          &AppMainWindow::playAllTracks);
  connect(tracksControls, &QToolBar::customContextMenuRequested, this,
          [this, tracksControls](const QPoint &pos) {
            QMenu menu;
            menu.addAction("Add visible to queue", this,
                           [this]() { addVisibleTracks(); });
            menu.addAction("Add all to queue", this,
                           [this]() { addAllTracks(); });
            menu.exec(tracksControls->mapToGlobal(pos));
          });

  QWidget *spacer = new QWidget();
  spacer->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
  tracksControls->addWidget(spacer);
  tracksLayout->addWidget(tracksControls);
  tracksLayout->addWidget(m_trackListView);
  m_leftStack->addWidget(m_tracksTab);

  // Bookmarks tab
  m_bookmarksWidget = new BookmarksWidget();
  m_bookmarksTab = m_bookmarksWidget;
  m_leftStack->addWidget(m_bookmarksTab);

  connect(m_bookmarksWidget, &BookmarksWidget::openBookmark, this,
          [this](const QString &query) {
            AppState *state = AppState::instance();
            m_searchInput->setText(query);
            state->setSearchQuery(query, 0);
            state->setLeftTab(LeftTab::Tracks);
            refreshSearch();
          });
  connect(
      m_bookmarksWidget, &BookmarksWidget::statusMessage, this,
      [this](const QString &message) { statusBar()->showMessage(message); });

  // Files tab
  m_fileBrowser = new FileBrowserWidget();
  m_filesTab = m_fileBrowser;
  m_leftStack->addWidget(m_filesTab);

  connect(m_fileBrowser, &FileBrowserWidget::showTracksInPath, this,
          [this](const QString &relativePath) {
            AppState *state = AppState::instance();
            const QString query = QString("path:\"%1\"").arg(relativePath);
            m_searchInput->setText(query);
            state->setSearchQuery(query, 0);
            state->setLeftTab(LeftTab::Tracks);
            refreshSearch();
          });
  connect(
      m_fileBrowser, &FileBrowserWidget::statusMessage, this,
      [this](const QString &message) { statusBar()->showMessage(message); });

  // Settings tab (placeholder)
  m_settingsTab = new QWidget();
  QVBoxLayout *settingsLayout = new QVBoxLayout(m_settingsTab);
  settingsLayout->addWidget(new QLabel("Settings"));
  m_leftStack->addWidget(m_settingsTab);
}

void AppMainWindow::setupRightPanel() {
  AppState *state = AppState::instance();

  m_rightPanel = new QWidget();
  m_rightPanel->setVisible(false);
  QVBoxLayout *rightLayout = new QVBoxLayout(m_rightPanel);
  rightLayout->setContentsMargins(0, 0, 0, 0);

  QWidget *header = new QWidget();
  QHBoxLayout *headerLayout = new QHBoxLayout(header);
  headerLayout->setContentsMargins(0, 0, 0, 0);
  headerLayout->addWidget(new QLabel("Queue"));
  headerLayout->addStretch();
  rightLayout->addWidget(header);

  m_queueListView = new TrackListView(TrackListView::Action::Unqueue, this);
  rightLayout->addWidget(m_queueListView);

  connect(m_queueListView, &TrackListView::unqueueRequested, this,
          [state](int row) { state->queueRemove(row); });

  connect(m_queueListView, &TrackListView::playRequested, this,
          [state](const TrackData &track, int row) {
            state->setQueueIndex(row);
            state->setCurrentTrack(track);
            state->setIsPlaying(true);
          });

  connect(m_queueListView, &TrackListView::removeAllRequested, this,
          [state]() { state->queueClear(); });

  connect(m_queueListView, &TrackListView::shuffleRequested, this,
          [state]() { state->queueShuffle(); });
}

void AppMainWindow::setupLayout() {
  m_splitter = new QSplitter(Qt::Horizontal);

  // Left side: tab bar + stack
  QWidget *leftPanel = new QWidget();
  QVBoxLayout *leftLayout = new QVBoxLayout(leftPanel);
  leftLayout->setContentsMargins(0, 0, 0, 0);

  QWidget *leftTopBar = new QWidget();
  QHBoxLayout *leftTopLayout = new QHBoxLayout(leftTopBar);
  leftTopLayout->setContentsMargins(0, 0, 0, 0);
  leftTopLayout->addWidget(m_leftTabBar);
  leftTopLayout->addStretch();
  leftLayout->addWidget(leftTopBar);

  leftLayout->addWidget(m_leftStack);

  m_splitter->addWidget(leftPanel);
  m_splitter->addWidget(m_rightPanel);

  // Main layout: splitter on top, music player at bottom
  QWidget *central = new QWidget();
  QVBoxLayout *centralLayout = new QVBoxLayout(central);
  centralLayout->setContentsMargins(0, 0, 0, 0);
  centralLayout->addWidget(m_splitter);
  centralLayout->addWidget(m_musicPlayer);

  setCentralWidget(central);
  resize(900, 600);
}

void AppMainWindow::setupShortcuts() {
  AppState *state = AppState::instance();

  auto *spaceShortcut = new QShortcut(QKeySequence(Qt::Key_Space), this);
  connect(spaceShortcut, &QShortcut::activated, this,
          [state]() { state->setIsPlaying(!state->isPlaying()); });

  auto *kShortcut = new QShortcut(QKeySequence(Qt::Key_K), this);
  connect(kShortcut, &QShortcut::activated, this,
          [state]() { state->setIsPlaying(!state->isPlaying()); });

  auto *mShortcut = new QShortcut(QKeySequence(Qt::Key_M), this);
  connect(mShortcut, &QShortcut::activated, this,
          [state]() { state->setMuted(!state->muted()); });

  auto *jShortcut = new QShortcut(QKeySequence(Qt::Key_J), this);
  connect(jShortcut, &QShortcut::activated, this,
          [state]() { state->setProgress(state->progress() - 10.0); });

  auto *lShortcut = new QShortcut(QKeySequence(Qt::Key_L), this);
  connect(lShortcut, &QShortcut::activated, this,
          [state]() { state->setProgress(state->progress() + 10.0); });
}

void AppMainWindow::resizeEvent(QResizeEvent *event) {
  QMainWindow::resizeEvent(event);
  updateSplitterOrientation();
}

void AppMainWindow::updateSplitterOrientation() {
  if (width() < COLLAPSE_AT_WIDTH) {
    m_splitter->setOrientation(Qt::Vertical);
  } else {
    m_splitter->setOrientation(Qt::Horizontal);
  }
}

void AppMainWindow::onSearchSubmit() {
  AppState *state = AppState::instance();
  QString query = m_searchInput->text();
  state->setSearchQuery(query, 0);
  refreshSearch();
}

void AppMainWindow::onTabClicked(int index) {
  AppState::instance()->setLeftTab(static_cast<LeftTab>(index));
}

void AppMainWindow::refreshSearch() {
  AppState *state = AppState::instance();
  QString q = state->searchQuery();

  qDebug() << "refreshSearch: query=" << q << "limit=-1";

  QJsonObject params;
  params["q"] = q;
  params["limit"] = "-1";

  m_searchWatcher->setFuture(m_api->get("/track", params));
}

void AppMainWindow::onPropsResultFinished() {
  QJsonDocument doc = m_propsWatcher->result();
  if (doc.isObject()) {
    AppState::instance()->setServerProps(doc.object());
  }
}

void AppMainWindow::onSearchResultFinished() {
  QJsonDocument doc = m_searchWatcher->result();
  if (doc.isNull()) {
    qDebug() << "onSearchResultFinished: null document";
    statusBar()->showMessage("Search failed");
    return;
  }

  QJsonObject obj = doc.object();
  QJsonArray tracksArr = obj["tracks"].toArray();
  QList<TrackData> tracks;
  for (const auto &v : tracksArr) {
    TrackData t = TrackData::fromJson(v.toObject());
    qDebug() << "track:" << t.id << t.name << t.artist << t.album << t.path;
    qDebug() << "track thumbnail_path:" << t.thumbnailPath;
    tracks.append(t);
  }

  qDebug() << "onSearchResultFinished: loaded" << tracks.size() << "tracks";

  m_trackListView->setTracks(tracks);
  AppState::instance()->setHighlightedTrackId(QString());
  statusBar()->showMessage(QString("Loaded %1 tracks").arg(tracks.size()));

  AppState *state = AppState::instance();
  QJsonObject filters = obj["filters"].toObject();
  state->setResultSort(filters["sort"].toString(),
                       filters["desc"].toString() == "1");
  state->setResultLimit(obj["limit"].toInt());
}

void AppMainWindow::playAllTracks() {
  fetchAllTracks(TrackFetchAction::PlayAll);
}

void AppMainWindow::addAllTracks() { fetchAllTracks(TrackFetchAction::AddAll); }

void AppMainWindow::addVisibleTracks() {
  const QList<TrackData> tracks = m_trackListView->tracks();
  if (tracks.isEmpty()) {
    statusBar()->showMessage("No tracks found");
    return;
  }

  AppState *state = AppState::instance();
  if (state->showOnlyQueueAfterEnqueue()) {
    state->setTracksListCollapsed(true);
    state->setQueueCollapsed(false);
  }
  state->queueAddAll(tracks);
}

void AppMainWindow::fetchAllTracks(TrackFetchAction action) {
  m_trackFetchAction = action;
  QJsonObject params;
  params["q"] = AppState::instance()->searchQuery();
  params["limit"] = "-1";
  m_trackFetchWatcher->setFuture(m_api->get("/track", params));
}

void AppMainWindow::onTrackFetchFinished() {
  QList<TrackData> tracks;
  QJsonDocument doc = m_trackFetchWatcher->result();
  if (doc.isObject()) {
    const QJsonArray arr = doc.object()["tracks"].toArray();
    for (const auto &v : arr) {
      tracks.append(TrackData::fromJson(v.toObject()));
    }
  }

  if (tracks.isEmpty()) {
    statusBar()->showMessage("No tracks found");
    m_trackFetchAction = TrackFetchAction::None;
    return;
  }

  AppState *state = AppState::instance();
  switch (m_trackFetchAction) {
  case TrackFetchAction::PlayAll:
    if (state->showOnlyQueueAfterEnqueue()) {
      state->setTracksListCollapsed(true);
      state->setQueueCollapsed(false);
    }
    state->queuePlayAll(tracks);
    break;
  case TrackFetchAction::AddAll:
    if (state->showOnlyQueueAfterEnqueue()) {
      state->setTracksListCollapsed(true);
      state->setQueueCollapsed(false);
    }
    state->queueAddAll(tracks);
    break;
  case TrackFetchAction::None:
    break;
  }
  m_trackFetchAction = TrackFetchAction::None;
}
