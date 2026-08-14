#include "AppMainWindow.h"
#include "ApiClient.h"
#include "AppState.h"
#include "BookmarksWidget.h"
#include "FileBrowserWidget.h"
#include "MusicPlayer.h"
#include "NativeAudioPlayer.h"
#include "SettingsWidget.h"
#include "TrackListView.h"

#include <QAction>
#include <QApplication>
#include <QCursor>
#include <QDebug>
#include <QHBoxLayout>
#include <QIcon>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMenu>
#include <QMessageBox>
#include <QPalette>
#include <QPushButton>
#include <QRegularExpression>
#include <QResizeEvent>
#include <QSettings>
#include <QShortcut>
#include <QSizePolicy>
#include <QStatusBar>
#include <QStringListModel>
#include <QToolBar>
#include <QToolButton>
#include <QUrl>
#include <QVBoxLayout>
#include <QtMath>

static const int COLLAPSE_AT_WIDTH = 800;

AppMainWindow::AppMainWindow(QWidget *parent)
    : QMainWindow(parent), m_api(ApiClient::instance()) {
  updateWindowTitle(QString());

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

  m_externalDownloadWatcher = new QFutureWatcher<QJsonDocument>(this);
  connect(m_externalDownloadWatcher, &QFutureWatcher<QJsonDocument>::finished,
          this, &AppMainWindow::onExternalDownloadFinished);

  m_loudnessWatcher = new QFutureWatcher<double>(this);
  connect(m_loudnessWatcher, &QFutureWatcher<double>::finished, this,
          &AppMainWindow::onLoudnessFinished);

  setupAudio();
  setupToolbar();
  setupLeftPanel();
  setupRightPanel();
  m_musicPlayer = new MusicPlayer();
  connect(m_musicPlayer, &MusicPlayer::pathRequested, this,
          [](const QStringList &path) {
            AppState *state = AppState::instance();
            state->setFbPath(path);
            state->setLeftTab(LeftTab::Files);
          });
  setupLayout();
  setupShortcuts();

  // Status bar
  statusBar()->showMessage("Ready");

  // Load config
  state->loadConfig();
  if (state->searchQuery() != "sort:id") {
    m_searchInput->setText(state->searchQuery());
  }
  updateSearchHistory(state->searchQuery());

  // Initial search to load all tracks on startup
  refreshSearch();

  // Connect state signals
  connect(state, &AppState::searchQueryChanged, this,
          [this](const QString &query, bool historyNavigation) {
            if (m_searchInput->text() != query)
              m_searchInput->setText(query);
            if (!historyNavigation)
              updateSearchHistory(query);
            AppState::instance()->setLeftTab(LeftTab::Tracks);
            refreshSearch();
          });

  connect(state, &AppState::currentTrackChanged, this,
          [this, state](const TrackData &track) {
            updateWindowTitle(track.name);
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

void AppMainWindow::updateWindowTitle(const QString &musicTitle) {
  const QString appTitle = QApplication::applicationName();
  if (musicTitle.isEmpty())
    setWindowTitle(appTitle);
  else
    setWindowTitle(QString("%1 — %2").arg(musicTitle, appTitle));
}

AppMainWindow::~AppMainWindow() { AppState::instance()->saveConfig(); }

void AppMainWindow::setupAudio() {
  AppState *state = AppState::instance();
  m_audioPlayer = new NativeAudioPlayer(this);

  // Player → AppState: sync time, duration, ended
  connect(m_audioPlayer, &NativeAudioPlayer::timeChanged, this,
          [state](qint64 ms) { state->setProgress(ms / 1000.0); });
  connect(m_audioPlayer, &NativeAudioPlayer::durationChanged, this,
          [state](qint64 ms) { state->setDuration(ms / 1000.0); });
  connect(m_audioPlayer, &NativeAudioPlayer::ended, this, [this, state]() {
    state->queueNext();
    if (state->isPlaying())
      m_audioPlayer->play();
  });

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
    if (AppState::instance()->normalize())
      return;
    m_audioPlayer->setAmplification(static_cast<float>(db));
  });
  connect(state, &AppState::currentTrackChanged, this,
          [this](const TrackData &) { updateNormalization(); });
  connect(state, &AppState::normalizeChanged, this,
          [this](bool) { updateNormalization(); });
  connect(state, &AppState::targetNormalizationDbsChanged, this,
          [this](double) { updateNormalization(); });
  connect(state, &AppState::maxNormalizationDbsChanged, this,
          [this](double) { updateNormalization(); });
}

void AppMainWindow::setupToolbar() {
  m_toolbar = addToolBar("Search");
  m_toolbar->setMovable(false);
  m_toolbar->setFloatable(false);
  m_toolbar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);

  m_backSearchAction =
      m_toolbar->addAction(QIcon::fromTheme("go-previous"), QString());
  m_backSearchAction->setToolTip("Back");
  connect(m_backSearchAction, &QAction::triggered, this,
          [this]() { navigateSearchHistory(-1); });

  m_forwardSearchAction =
      m_toolbar->addAction(QIcon::fromTheme("go-next"), QString());
  m_forwardSearchAction->setToolTip("Forward");
  connect(m_forwardSearchAction, &QAction::triggered, this,
          [this]() { navigateSearchHistory(1); });

  auto *backButton = qobject_cast<QToolButton *>(
      m_toolbar->widgetForAction(m_backSearchAction));
  m_searchHistoryMenu = new QMenu(this);
  m_searchHistoryMenu->setTitle("Search History");
  m_searchHistoryMenu->setSeparatorsCollapsible(false);
  connect(m_searchHistoryMenu, &QMenu::aboutToShow, this,
          &AppMainWindow::showSearchHistoryMenu);
  backButton->setMenu(m_searchHistoryMenu);
  backButton->setPopupMode(QToolButton::MenuButtonPopup);

  QAction *homeAction =
      m_toolbar->addAction(QIcon::fromTheme("go-home"), QString());
  homeAction->setToolTip("Go to Top");
  connect(homeAction, &QAction::triggered, this,
          [this]() { m_trackListView->scrollToTop(); });
  updateSearchHistoryActions();

  m_searchInput = new QLineEdit();
  m_searchInput->setPlaceholderText("Search Tracks...");
  m_searchInput->setClearButtonEnabled(true);
  m_searchInput->setMinimumWidth(200);

  m_searchCompleter = new QCompleter(this);
  m_searchCompleter->setCaseSensitivity(Qt::CaseInsensitive);
  m_searchCompleter->setFilterMode(Qt::MatchContains);
  m_searchCompleter->setCompletionMode(QCompleter::PopupCompletion);
  auto *historyModel = new QStringListModel(this);
  QSettings settings;
  historyModel->setStringList(
      settings.value("searchSuggestions").toStringList());
  m_searchCompleter->setModel(historyModel);
  m_searchInput->setCompleter(m_searchCompleter);
  connect(m_searchCompleter,
          QOverload<const QString &>::of(&QCompleter::activated), this,
          [this](const QString &query) {
            m_searchInput->setText(query);
            onSearchSubmit();
          });

  connect(m_searchInput, &QLineEdit::returnPressed, this,
          &AppMainWindow::onSearchSubmit);
  connect(m_searchInput, &QLineEdit::textChanged, this,
          [this](const QString &text) {
            const QJsonObject config =
                AppState::instance()->serverProps()["config"].toObject();
            const bool hasDownloader =
                !config["media_downloader"].toString().isEmpty();
            const QString value = text.trimmed();
            const bool isUrl =
                value.startsWith("http://") || value.startsWith("https://");
            if (m_downloadAction) {
              m_downloadAction->setVisible(hasDownloader && isUrl);
              m_downloadAction->setEnabled(hasDownloader && isUrl);
            }
          });

  m_toolbar->addWidget(m_searchInput);

  QAction *searchAction =
      m_toolbar->addAction(QIcon::fromTheme("system-search"), "Search");
  connect(searchAction, &QAction::triggered, this,
          &AppMainWindow::onSearchSubmit);

  m_downloadAction =
      m_toolbar->addAction(QIcon::fromTheme("download"), "Download");
  m_downloadAction->setToolTip("Download tracks from an HTTP or HTTPS URL");
  m_downloadAction->setVisible(false);
  m_downloadAction->setEnabled(false);
  connect(m_downloadAction, &QAction::triggered, this,
          &AppMainWindow::startExternalDownload);
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
  connect(
      m_trackListView, &TrackListView::statusMessage, this,
      [this](const QString &message) { statusBar()->showMessage(message); });

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
      QIcon::fromTheme("media-playback-start"), "Play All");
  connect(playAllAction, &QAction::triggered, this,
          &AppMainWindow::playAllTracks);
  connect(tracksControls, &QToolBar::customContextMenuRequested, this,
          [this, tracksControls](const QPoint &pos) {
            QMenu menu;
            menu.addAction("Add Visible to Queue", this,
                           [this]() { addVisibleTracks(); });
            menu.addAction("Add All to Queue", this,
                           [this]() { addAllTracks(); });
            menu.exec(tracksControls->mapToGlobal(pos));
          });

  QWidget *spacer = new QWidget();
  spacer->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
  tracksControls->addWidget(spacer);

  // Sort action: context menu mirroring the React frontend sort selector
  QAction *sortAction =
      tracksControls->addAction(QIcon::fromTheme("view-sort"), "Sort");
  sortAction->setToolTip("Change sort order");
  connect(sortAction, &QAction::triggered, this, [this]() {
    AppState *state = AppState::instance();
    QMenu menu;
    const struct {
      const char *label;
      const char *field;
    } options[] = {{"ID", "id"},
                   {"Name", "name"},
                   {"Path", "path"},
                   {"Artist", "artist"},
                   {"Album", "album"}};
    for (const auto &opt : options) {
      QAction *a = menu.addAction(opt.label);
      a->setCheckable(true);
      a->setChecked(state->resultSort() == opt.field);
      const QString field = opt.field;
      connect(a, &QAction::triggered, this,
              [this, field]() { setTrackSort(field); });
    }
    menu.exec(QCursor::pos());
  });

  tracksLayout->addWidget(tracksControls);
  tracksLayout->addWidget(m_trackListView);
  m_leftStack->addWidget(m_tracksTab);

  // Bookmarks tab
  m_bookmarksWidget = new BookmarksWidget();
  m_bookmarksTab = m_bookmarksWidget;
  m_leftStack->addWidget(m_bookmarksTab);

  connect(m_bookmarksWidget, &BookmarksWidget::openBookmark, this,
          [this](const QString &query) {
            AppState::instance()->setSearchQuery(query, 0);
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
            const QString query = QString("path:\"%1\"").arg(relativePath);
            AppState::instance()->setSearchQuery(query, 0);
          });
  connect(
      m_fileBrowser, &FileBrowserWidget::statusMessage, this,
      [this](const QString &message) { statusBar()->showMessage(message); });

  // Settings tab
  m_settingsWidget = new SettingsWidget();
  m_settingsTab = m_settingsWidget;
  m_leftStack->addWidget(m_settingsTab);

  connect(
      m_settingsWidget, &SettingsWidget::statusMessage, this,
      [this](const QString &message) { statusBar()->showMessage(message); });
  connect(m_settingsWidget, &SettingsWidget::rescanCompleted, this,
          [this]() { refreshSearch(); });
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
  connect(
      m_queueListView, &TrackListView::statusMessage, this,
      [this](const QString &message) { statusBar()->showMessage(message); });
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
  m_splitter->setAutoFillBackground(true);
  m_splitter->setBackgroundRole(QPalette::Base);

  // Left side: tab bar + stack
  QWidget *leftPanel = new QWidget();
  QVBoxLayout *leftLayout = new QVBoxLayout(leftPanel);
  leftLayout->setContentsMargins(0, 0, 0, 0);

  QWidget *leftTopBar = new QWidget();
  QHBoxLayout *leftTopLayout = new QHBoxLayout(leftTopBar);
  leftTopLayout->setContentsMargins(0, 0, 0, 0);
  leftTopLayout->addWidget(m_leftTabBar);
  leftLayout->addWidget(leftTopBar);

  leftLayout->addWidget(m_leftStack, 1);

  m_splitter->addWidget(leftPanel);
  m_splitter->addWidget(m_rightPanel);

  // Main layout: splitter on top, music player at bottom
  QWidget *central = new QWidget();

  QVBoxLayout *centralLayout = new QVBoxLayout(central);
  centralLayout->setContentsMargins(0, 0, 0, 0);
  centralLayout->setSpacing(0);
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

  auto *backShortcut = new QShortcut(QKeySequence(Qt::ALT | Qt::Key_Left), this);
  connect(backShortcut, &QShortcut::activated, this,
          [this]() { navigateSearchHistory(-1); });

  auto *forwardShortcut =
      new QShortcut(QKeySequence(Qt::ALT | Qt::Key_Right), this);
  connect(forwardShortcut, &QShortcut::activated, this,
          [this]() { navigateSearchHistory(1); });
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
}

void AppMainWindow::updateSearchHistory(const QString &query) {
  qDebug() << "updateSearchHistory" << query;
  if (query.isEmpty())
    return;

  if (m_searchHistoryIndex + 1 < m_searchHistory.size())
    m_searchHistory = m_searchHistory.mid(0, m_searchHistoryIndex + 1);
  if (m_searchHistory.isEmpty() || m_searchHistory.last() != query)
    m_searchHistory.append(query);
  if (m_searchHistory.size() > 1000)
    m_searchHistory.removeFirst();
  m_searchHistoryIndex = m_searchHistory.size() - 1;
  updateSearchHistoryActions();

  QSettings settings;
  QStringList suggestions = settings.value("searchSuggestions").toStringList();
  suggestions.removeAll(query);
  suggestions.prepend(query);
  suggestions = suggestions.mid(0, AppState::instance()->searchHistoryLimit());
  settings.setValue("searchSuggestions", suggestions);
  static_cast<QStringListModel *>(m_searchCompleter->model())
      ->setStringList(suggestions);
}

void AppMainWindow::navigateSearchHistory(int direction) {
  const int nextIndex = m_searchHistoryIndex + direction;
  if (nextIndex < 0 || nextIndex >= m_searchHistory.size())
    return;

  m_searchHistoryIndex = nextIndex;
  const QString query = m_searchHistory.at(nextIndex);
  AppState::instance()->setSearchQuery(query, 0, true);
  updateSearchHistoryActions();
}

void AppMainWindow::showSearchHistoryMenu() {
  m_searchHistoryMenu->clear();
  for (int i = m_searchHistory.size() - 1; i >= 0; --i) {
    QAction *action = m_searchHistoryMenu->addAction(m_searchHistory.at(i));
    action->setData(i);
    action->setCheckable(true);
    action->setChecked(i == m_searchHistoryIndex);
    connect(action, &QAction::triggered, this, [this, action]() {
      const int index = action->data().toInt();
      if (index >= 0 && index < m_searchHistory.size()) {
        m_searchHistoryIndex = index;
        const QString query = m_searchHistory.at(index);
        AppState::instance()->setSearchQuery(query, 0, true);
        updateSearchHistoryActions();
      }
    });
  }
}

void AppMainWindow::updateSearchHistoryActions() {
  if (m_backSearchAction) {
    m_backSearchAction->setEnabled(m_searchHistoryIndex > 0);
    m_forwardSearchAction->setEnabled(
        m_searchHistoryIndex >= 0 &&
        m_searchHistoryIndex + 1 < m_searchHistory.size());
  }
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
    const QJsonObject config = doc.object()["config"].toObject();
    const bool hasDownloader = !config["media_downloader"].toString().isEmpty();
    const QString value = m_searchInput->text().trimmed();
    const bool isUrl =
        value.startsWith("http://") || value.startsWith("https://");
    if (m_downloadAction) {
      m_downloadAction->setVisible(hasDownloader && isUrl);
      m_downloadAction->setEnabled(hasDownloader && isUrl);
    }
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
    // qDebug() << "track:" << t.id << t.name << t.artist << t.album << t.path;
    // qDebug() << "track thumbnail_path:" << t.thumbnailPath;
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

void AppMainWindow::setTrackSort(const QString &field) {
  AppState *state = AppState::instance();
  QString q = state->searchQuery();
  static const QRegularExpression sortRe("\\bsort:[^ ]+");
  if (sortRe.match(q).hasMatch())
    q = q.replace(sortRe, QString("sort:%1").arg(field));
  else
    q = (q.trimmed() + " sort:" + field).trimmed();
  state->setSearchQuery(q, 0);
  if (m_leftStack && m_leftStack->currentWidget() == m_tracksTab)
    m_trackListView->scrollToTop();
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
  state->queueAddAll(tracks);
}

void AppMainWindow::fetchAllTracks(TrackFetchAction action) {
  m_trackFetchAction = action;
  QJsonObject params;
  params["q"] = AppState::instance()->searchQuery();
  params["limit"] = "-1";
  m_trackFetchWatcher->setFuture(m_api->get("/track", params));
}

void AppMainWindow::startExternalDownload() {
  const QString url = m_searchInput->text().trimmed();
  if (!(url.startsWith("http://") || url.startsWith("https://"))) {
    statusBar()->showMessage("Enter an HTTP or HTTPS URL to download");
    return;
  }
  if (m_externalDownloadWatcher->isRunning()) {
    statusBar()->showMessage("A download operation is already running");
    return;
  }

  m_externalDownloadUrl = url;
  m_externalDownloadPath =
      QString("/track/:external/%1").arg(QUrl::toPercentEncoding(url));
  m_externalDownloadPost = false;
  m_downloadAction->setEnabled(false);
  statusBar()->showMessage("Looking up external tracks...");
  m_externalDownloadWatcher->setFuture(m_api->get(m_externalDownloadPath));
}

void AppMainWindow::onExternalDownloadFinished() {
  const QJsonDocument doc = m_externalDownloadWatcher->result();
  m_downloadAction->setEnabled(true);

  if (doc.isNull()) {
    statusBar()->showMessage("Unable to get track data");
    return;
  }

  if (!m_externalDownloadPost) {
    const QJsonArray tracks =
        doc.isArray() ? doc.array() : doc.object()["tracks"].toArray();
    if (tracks.isEmpty()) {
      statusBar()->showMessage("No external tracks found");
      return;
    }

    QStringList names;
    for (const QJsonValue &value : tracks) {
      const QString name = value.toObject()["name"].toString();
      if (!name.isEmpty())
        names.append(name);
    }
    const QString details =
        names.isEmpty()
            ? QString("Download tracks from %1?").arg(m_externalDownloadUrl)
            : QString("Download these tracks from %1?\n\n%2")
                  .arg(m_externalDownloadUrl, names.join("\n"));
    const auto answer = QMessageBox::question(
        this, "Download Tracks", details, QMessageBox::Yes | QMessageBox::No,
        QMessageBox::Yes);
    if (answer != QMessageBox::Yes) {
      statusBar()->showMessage("Download cancelled");
      return;
    }

    m_externalDownloadPost = true;
    m_downloadAction->setEnabled(false);
    statusBar()->showMessage("Download started");
    m_externalDownloadWatcher->setFuture(m_api->post(m_externalDownloadPath));
    return;
  }

  m_externalDownloadPost = false;
  if (doc.isObject() && doc.object().contains("error")) {
    statusBar()->showMessage("Download failed: " +
                             doc.object()["error"].toString());
    return;
  }
  statusBar()->showMessage("Download completed");
  refreshSearch();
}

void AppMainWindow::updateNormalization() {
  AppState *state = AppState::instance();
  const TrackData *track = state->currentTrack();
  if (!state->normalize() || track->id.isEmpty()) {
    m_loudnessTrackId.clear();
    if (m_loudnessWatcher->isRunning())
      m_loudnessWatcher->cancel();
    m_audioPlayer->setAmplification(static_cast<float>(state->amplification()));
    return;
  }

  m_loudnessTrackId = track->id;
  m_loudnessWatcher->setFuture(m_api->getLoudness(track->id));
}

void AppMainWindow::onLoudnessFinished() {
  AppState *state = AppState::instance();
  const double loudness = m_loudnessWatcher->result();
  const QString trackId = m_loudnessTrackId;
  if (trackId.isEmpty() || state->currentTrack()->id != trackId ||
      !state->normalize())
    return;

  if (!qIsFinite(loudness)) {
    statusBar()->showMessage("Failed to get track loudness");
    m_audioPlayer->setAmplification(static_cast<float>(state->amplification()));
    return;
  }
  const double gain = qMin(state->targetNormalizationDbs() - loudness,
                           state->maxNormalizationDbs());
  m_audioPlayer->setAmplification(static_cast<float>(gain));
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
    state->queuePlayAll(tracks);
    break;
  case TrackFetchAction::AddAll:
    state->queueAddAll(tracks);
    break;
  case TrackFetchAction::None:
    break;
  }
  m_trackFetchAction = TrackFetchAction::None;
}
