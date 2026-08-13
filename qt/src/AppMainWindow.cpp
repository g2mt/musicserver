#include "AppMainWindow.h"
#include "ApiClient.h"
#include "AppState.h"
#include "FileBrowserWidget.h"
#include "MusicPlayer.h"
#include "QtAudioPlayer.h"
#include "TrackDelegate.h"
#include "TrackListModel.h"

#include <QAction>
#include <QApplication>
#include <QByteArray>
#include <QDebug>
#include <QHBoxLayout>
#include <QIcon>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMenu>
#include <QPixmap>
#include <QPushButton>
#include <QResizeEvent>
#include <QShortcut>
#include <QStatusBar>
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
            m_trackListModel->setHighlightedTrackId(id);
          });

  connect(state, &AppState::leftTabChanged, this, [this](LeftTab tab) {
    m_leftStack->setCurrentIndex(static_cast<int>(tab));
  });

  connect(state, &AppState::tracksListCollapsedChanged, this,
          [this](bool collapsed) { m_leftStack->setVisible(!collapsed); });

  connect(state, &AppState::queueCollapsedChanged, this,
          [this](bool collapsed) { m_queueContent->setVisible(!collapsed); });

  connect(state, &AppState::queueTracksChanged, this,
          [this](const QList<TrackData> &tracks) {
            m_queueListModel->setTracks(tracks);
            m_rightPanel->setVisible(!tracks.isEmpty());
          });

  connect(state, &AppState::queueTracksAdded, this,
          [this](const QList<TrackData> &tracks, int startIndex) {
            m_queueListModel->insertTracks(tracks, startIndex);
            m_rightPanel->setVisible(true);
          });

  connect(state, &AppState::queueTracksRemoved, this,
          [this, state](int startIndex, int count) {
            m_queueListModel->removeTracks(startIndex, count);
            m_rightPanel->setVisible(!state->queueTracks().isEmpty());
          });

  connect(state, &AppState::queueIndexChanged, this,
          [this, state](int index) {
            const QList<TrackData> tracks = state->queueTracks();
            const QString id = (index >= 0 && index < tracks.size())
                                   ? tracks.at(index).id
                                   : QString();
            m_queueListModel->setHighlightedTrackId(id);
          });

  // Progress timer (replace SSE polling)
  m_progressTimer = new QTimer(this);
  m_progressTimer->setInterval(500);
  m_progressTimer->start();
}

AppMainWindow::~AppMainWindow() { AppState::instance()->saveConfig(); }

void AppMainWindow::setupAudio() {
  AppState *state = AppState::instance();
  m_audioPlayer = new QtAudioPlayer(this);

  // Player → AppState: sync time, duration, ended
  connect(m_audioPlayer, &QtAudioPlayer::timeChanged, this,
          [state](qint64 ms) { state->setProgress(ms / 1000.0); });
  connect(m_audioPlayer, &QtAudioPlayer::durationChanged, this,
          [state](qint64 ms) { state->setDuration(ms / 1000.0); });
  connect(m_audioPlayer, &QtAudioPlayer::ended, this,
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
  m_leftTabBar->addTab("Tracks");
  m_leftTabBar->addTab("Bookmarks");
  m_leftTabBar->addTab("Files");
  m_leftTabBar->addTab("Settings");

  connect(m_leftTabBar, &QTabBar::currentChanged, this,
          &AppMainWindow::onTabClicked);

  m_leftStack = new QStackedWidget();

  // Tracks tab
  m_tracksTab = new QWidget();
  QVBoxLayout *tracksLayout = new QVBoxLayout(m_tracksTab);
  tracksLayout->setContentsMargins(0, 0, 0, 0);

  m_trackListView = new QListView();
  m_trackListModel = new TrackListModel(this);
  m_trackListView->setModel(m_trackListModel);

  m_trackDelegate = new TrackDelegate(this);
  m_trackDelegate->setModel(m_trackListModel);
  m_trackDelegate->setAction(TrackDelegate::Action::Enqueue);
  m_trackListView->setItemDelegate(m_trackDelegate);
  m_trackListView->setUniformItemSizes(true);
  m_trackListView->setAlternatingRowColors(true);
  m_trackListView->setContextMenuPolicy(Qt::CustomContextMenu);

  connect(m_trackDelegate, &TrackDelegate::trackActionClicked, this,
          [this](int row) {
            if (row < 0 || row >= m_trackListModel->tracks().size())
              return;
            AppState::instance()->queueAdd(m_trackListModel->tracks().at(row));
          });

  connect(m_trackListModel, &TrackListModel::coverRequested, this,
          [this](int row, const QString &trackId) {
            Q_UNUSED(row);
            QFuture<QByteArray> future =
                m_api->getBytes(QString("/track/%1/cover").arg(trackId));
            auto *watcher = new QFutureWatcher<QByteArray>(this);
            connect(watcher, &QFutureWatcher<QByteArray>::finished, this,
                    [this, watcher, trackId]() {
                      QByteArray bytes = watcher->result();
                      watcher->deleteLater();
                      QPixmap pix;
                      if (!bytes.isEmpty() && pix.loadFromData(bytes)) {
                        m_trackListModel->setCoverPixmap(trackId, pix);
                      }
                    });
            watcher->setFuture(future);
          });

  connect(m_trackListView, &QListView::doubleClicked, this,
          [this](const QModelIndex &index) {
            TrackData track = qvariant_cast<TrackData>(
                index.data(TrackListModel::TrackDataRole));
            AppState *state = AppState::instance();
            state->setHighlightedTrackId(track.id);
            state->setCurrentTrack(track);
            state->setIsPlaying(true);
          });

  connect(m_trackListView, &QListView::customContextMenuRequested, this,
          [this](const QPoint &pos) {
            QModelIndex index = m_trackListView->indexAt(pos);
            if (!index.isValid())
              return;
            TrackData track = qvariant_cast<TrackData>(
                index.data(TrackListModel::TrackDataRole));
            AppState *state = AppState::instance();

            QMenu menu;
            menu.addAction(QIcon::fromTheme("media-playback-start"), "Play",
                           this, [state, track]() {
                             state->setHighlightedTrackId(track.id);
                             state->setCurrentTrack(track);
                             state->setIsPlaying(true);
                           });
            menu.addAction(QIcon::fromTheme("list-add"), "Add to queue", this,
                           [state, track]() { state->queueAdd(track); });
            menu.exec(m_trackListView->viewport()->mapToGlobal(pos));
          });

  QWidget *tracksControls = new QWidget();
  QHBoxLayout *controlsLayout = new QHBoxLayout(tracksControls);
  controlsLayout->setContentsMargins(0, 0, 0, 0);

  QPushButton *playAllBtn =
      new QPushButton(QIcon::fromTheme("media-playback-start"), "Play all");
  playAllBtn->setContextMenuPolicy(Qt::CustomContextMenu);
  connect(playAllBtn, &QPushButton::clicked, this,
          &AppMainWindow::playAllTracks);
  connect(playAllBtn, &QPushButton::customContextMenuRequested, this,
          [this, playAllBtn](const QPoint &pos) {
            QMenu menu;
            menu.addAction("Add visible to queue", this,
                           [this]() { addVisibleTracks(); });
            menu.addAction("Add all to queue", this,
                           [this]() { addAllTracks(); });
            menu.exec(playAllBtn->mapToGlobal(pos));
          });

  controlsLayout->addStretch();
  controlsLayout->addWidget(playAllBtn);
  tracksLayout->addWidget(tracksControls);
  tracksLayout->addWidget(m_trackListView);
  m_leftStack->addWidget(m_tracksTab);

  // Bookmarks tab (placeholder)
  m_bookmarksTab = new QWidget();
  QVBoxLayout *bookmarksLayout = new QVBoxLayout(m_bookmarksTab);
  bookmarksLayout->addWidget(new QLabel("Bookmarks"));
  m_leftStack->addWidget(m_bookmarksTab);

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
  connect(m_fileBrowser, &FileBrowserWidget::statusMessage, this,
          [this](const QString &message) {
            statusBar()->showMessage(message);
          });

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

  QPushButton *collapseBtn = new QPushButton();
  collapseBtn->setIcon(QIcon::fromTheme("go-down"));
  collapseBtn->setFixedSize(24, 24);
  connect(collapseBtn, &QPushButton::clicked, this,
          &AppMainWindow::onCollapseQueue);
  headerLayout->addWidget(collapseBtn);
  rightLayout->addWidget(header);

  m_queueContent = new QWidget();
  QVBoxLayout *queueLayout = new QVBoxLayout(m_queueContent);
  queueLayout->setContentsMargins(0, 0, 0, 0);

  QWidget *actions = new QWidget();
  QHBoxLayout *actionsLayout = new QHBoxLayout(actions);
  actionsLayout->setContentsMargins(0, 0, 0, 0);
  QPushButton *removeAllBtn = new QPushButton("Remove all");
  QPushButton *shuffleBtn = new QPushButton("Shuffle");
  connect(removeAllBtn, &QPushButton::clicked, this,
          [state]() { state->queueClear(); });
  connect(shuffleBtn, &QPushButton::clicked, this,
          [state]() { state->queueShuffle(); });
  actionsLayout->addWidget(removeAllBtn);
  actionsLayout->addWidget(shuffleBtn);
  actionsLayout->addStretch();
  queueLayout->addWidget(actions);

  m_queueListView = new QListView();
  m_queueListModel = new TrackListModel(this);
  m_queueListView->setModel(m_queueListModel);

  m_queueDelegate = new TrackDelegate(this);
  m_queueDelegate->setModel(m_queueListModel);
  m_queueDelegate->setAction(TrackDelegate::Action::Unqueue);
  m_queueListView->setItemDelegate(m_queueDelegate);
  m_queueListView->setUniformItemSizes(true);
  m_queueListView->setAlternatingRowColors(true);
  m_queueListView->setContextMenuPolicy(Qt::CustomContextMenu);
  queueLayout->addWidget(m_queueListView);

  rightLayout->addWidget(m_queueContent);

  connect(m_queueDelegate, &TrackDelegate::trackActionClicked, this,
          [state](int row) { state->queueRemove(row); });

  connect(m_queueListView, &QListView::doubleClicked, this,
          [this, state](const QModelIndex &index) {
            TrackData track = qvariant_cast<TrackData>(
                index.data(TrackListModel::TrackDataRole));
            state->setQueueIndex(index.row());
            state->setCurrentTrack(track);
            state->setIsPlaying(true);
          });

  connect(m_queueListView, &QListView::customContextMenuRequested, this,
          [this, state](const QPoint &pos) {
            QModelIndex index = m_queueListView->indexAt(pos);
            if (!index.isValid())
              return;
            TrackData track = qvariant_cast<TrackData>(
                index.data(TrackListModel::TrackDataRole));
            QMenu menu;
            menu.addAction(QIcon::fromTheme("media-playback-start"), "Play",
                           this, [state, index, track]() {
                             state->setQueueIndex(index.row());
                             state->setCurrentTrack(track);
                             state->setIsPlaying(true);
                           });
            menu.addAction("Remove", this,
                           [state, index]() { state->queueRemove(index.row()); });
            menu.exec(m_queueListView->viewport()->mapToGlobal(pos));
          });

  connect(m_queueListModel, &TrackListModel::coverRequested, this,
          [this](int row, const QString &trackId) {
            Q_UNUSED(row);
            QFuture<QByteArray> future =
                m_api->getBytes(QString("/track/%1/cover").arg(trackId));
            auto *watcher = new QFutureWatcher<QByteArray>(this);
            connect(watcher, &QFutureWatcher<QByteArray>::finished, this,
                    [this, watcher, trackId]() {
                      QByteArray bytes = watcher->result();
                      watcher->deleteLater();
                      QPixmap pix;
                      if (!bytes.isEmpty() && pix.loadFromData(bytes)) {
                        m_queueListModel->setCoverPixmap(trackId, pix);
                      }
                    });
            watcher->setFuture(future);
          });
}

void AppMainWindow::setupLayout() {
  m_splitter = new QSplitter(Qt::Horizontal);

  // Left side: tab bar (+ collapse button) + stack
  QWidget *leftPanel = new QWidget();
  QVBoxLayout *leftLayout = new QVBoxLayout(leftPanel);
  leftLayout->setContentsMargins(0, 0, 0, 0);

  // Collapse button
  QPushButton *collapseBtn = new QPushButton();
  collapseBtn->setIcon(QIcon::fromTheme("go-down"));
  collapseBtn->setFixedSize(24, 24);
  connect(collapseBtn, &QPushButton::clicked, this,
          &AppMainWindow::onCollapseTracksList);
  // Place collapse button in tab bar area via a horizontal layout
  QWidget *leftTopBar = new QWidget();
  QHBoxLayout *leftTopLayout = new QHBoxLayout(leftTopBar);
  leftTopLayout->setContentsMargins(0, 0, 0, 0);
  leftTopLayout->addWidget(m_leftTabBar);
  leftTopLayout->addStretch();
  leftTopLayout->addWidget(collapseBtn);
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

void AppMainWindow::onCollapseTracksList() {
  AppState *state = AppState::instance();
  state->setTracksListCollapsed(!state->tracksListCollapsed());
}

void AppMainWindow::onCollapseQueue() {
  AppState *state = AppState::instance();
  state->setQueueCollapsed(!state->queueCollapsed());
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

  m_trackListModel->setTracks(tracks);
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

void AppMainWindow::addAllTracks() {
  fetchAllTracks(TrackFetchAction::AddAll);
}

void AppMainWindow::addVisibleTracks() {
  const QList<TrackData> tracks = m_trackListModel->tracks();
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
