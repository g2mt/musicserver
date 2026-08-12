#include "AppMainWindow.h"
#include "ApiClient.h"
#include "AppState.h"
#include "TrackListModel.h"

#include <QAction>
#include <QApplication>
#include <QHBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QPushButton>
#include <QResizeEvent>
#include <QShortcut>
#include <QStatusBar>
#include <QVBoxLayout>

static const int COLLAPSE_AT_WIDTH = 800;

AppMainWindow::AppMainWindow(ApiClient *api, QWidget *parent)
    : QMainWindow(parent), m_api(api) {
	setWindowTitle("Music Server");

	AppState *state = AppState::instance();

	setupToolbar();
	setupLeftPanel();
	setupRightPanel();
	setupLayout();
	setupShortcuts();

	// Music player placeholder
	m_musicPlayer = new QWidget();
	m_musicPlayer->setFixedHeight(100);
	m_musicPlayer->setStyleSheet("background: #1c1d20;");

	// Status bar
	statusBar()->showMessage("Ready");

	// Load config
	state->loadConfig();

	// Connect search watcher
	m_searchWatcher = new QFutureWatcher<QJsonDocument>(this);
	connect(m_searchWatcher, &QFutureWatcher<QJsonDocument>::finished,
	        this, &AppMainWindow::onSearchResultFinished);

	// Connect state signals
	connect(state, &AppState::currentTrackChanged, this, [this](const TrackData &track) {
		setWindowTitle(track.name.isEmpty() ? "Music Server" : track.name);
	});

	connect(state, &AppState::leftTabChanged, this, [this](LeftTab tab) {
		m_leftStack->setCurrentIndex(static_cast<int>(tab));
	});

	connect(state, &AppState::tracksListCollapsedChanged, this, [this](bool collapsed) {
		m_leftStack->setVisible(!collapsed);
	});

	connect(state, &AppState::queueCollapsedChanged, this, [this](bool collapsed) {
		m_queueListView->setVisible(!collapsed);
	});

	connect(state, &AppState::queueTracksChanged, this, [this]() {
		bool hasTracks = !AppState::instance()->queueTracks().isEmpty();
		m_rightPanel->setVisible(hasTracks);
	});

	// Progress timer (replace SSE polling)
	m_progressTimer = new QTimer(this);
	m_progressTimer->setInterval(500);
	m_progressTimer->start();
}

AppMainWindow::~AppMainWindow() {
	AppState::instance()->saveConfig();
}

void AppMainWindow::setupToolbar() {
	m_toolbar = addToolBar("Search");
	m_toolbar->setMovable(false);
	m_toolbar->setFloatable(false);

	m_searchInput = new QLineEdit();
	m_searchInput->setPlaceholderText("Search tracks...");
	m_searchInput->setClearButtonEnabled(true);
	m_searchInput->setMinimumWidth(200);

	connect(m_searchInput, &QLineEdit::returnPressed, this,
	        &AppMainWindow::onSearchSubmit);

	m_toolbar->addWidget(m_searchInput);

	QAction *searchAction = m_toolbar->addAction("Search");
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
	tracksLayout->addWidget(m_trackListView);
	m_leftStack->addWidget(m_tracksTab);

	// Bookmarks tab (placeholder)
	m_bookmarksTab = new QWidget();
	QVBoxLayout *bookmarksLayout = new QVBoxLayout(m_bookmarksTab);
	bookmarksLayout->addWidget(new QLabel("Bookmarks"));
	m_leftStack->addWidget(m_bookmarksTab);

	// Files tab (placeholder)
	m_filesTab = new QWidget();
	QVBoxLayout *filesLayout = new QVBoxLayout(m_filesTab);
	filesLayout->addWidget(new QLabel("Files"));
	m_leftStack->addWidget(m_filesTab);

	// Settings tab (placeholder)
	m_settingsTab = new QWidget();
	QVBoxLayout *settingsLayout = new QVBoxLayout(m_settingsTab);
	settingsLayout->addWidget(new QLabel("Settings"));
	m_leftStack->addWidget(m_settingsTab);
}

void AppMainWindow::setupRightPanel() {
	m_rightPanel = new QWidget();
	m_rightPanel->setVisible(false);
	QVBoxLayout *rightLayout = new QVBoxLayout(m_rightPanel);
	rightLayout->setContentsMargins(0, 0, 0, 0);

	m_rightTabBar = new QTabBar();
	m_rightTabBar->addTab("Queue");
	m_rightTabBar->setExpanding(false);
	rightLayout->addWidget(m_rightTabBar);

	m_queueListView = new QListView();
	m_queueListModel = new TrackListModel(this);
	m_queueListView->setModel(m_queueListModel);
	rightLayout->addWidget(m_queueListView);
}

void AppMainWindow::setupLayout() {
	m_splitter = new QSplitter(Qt::Horizontal);

	// Left side: tab bar (+ collapse button) + stack
	QWidget *leftPanel = new QWidget();
	QVBoxLayout *leftLayout = new QVBoxLayout(leftPanel);
	leftLayout->setContentsMargins(0, 0, 0, 0);

	// Collapse button
	QPushButton *collapseBtn = new QPushButton("-");
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
	connect(spaceShortcut, &QShortcut::activated, this, [state]() {
		state->setIsPlaying(!state->isPlaying());
	});

	auto *kShortcut = new QShortcut(QKeySequence(Qt::Key_K), this);
	connect(kShortcut, &QShortcut::activated, this, [state]() {
		state->setIsPlaying(!state->isPlaying());
	});

	auto *mShortcut = new QShortcut(QKeySequence(Qt::Key_M), this);
	connect(mShortcut, &QShortcut::activated, this, [state]() {
		state->setMuted(!state->muted());
	});

	auto *jShortcut = new QShortcut(QKeySequence(Qt::Key_J), this);
	connect(jShortcut, &QShortcut::activated, this, [state]() {
		state->setProgress(state->progress() - 10.0);
	});

	auto *lShortcut = new QShortcut(QKeySequence(Qt::Key_L), this);
	connect(lShortcut, &QShortcut::activated, this, [state]() {
		state->setProgress(state->progress() + 10.0);
	});
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

	QJsonObject params;
	params["q"] = q;
	params["limit"] = QString::number(state->resultLimit());

	QFuture<QJsonDocument> future = m_api->get("/track", params);
	m_searchWatcher->setFuture(future);
}

void AppMainWindow::onSearchResultFinished() {
	QJsonDocument doc = m_searchWatcher->result();
	if (doc.isNull()) return;

	QJsonObject obj = doc.object();
	QJsonArray tracksArr = obj["tracks"].toArray();
	QList<TrackData> tracks;
	for (const auto &v : tracksArr) {
		tracks.append(TrackData::fromJson(v.toObject()));
	}

	m_trackListModel->setTracks(tracks);

	AppState *state = AppState::instance();
	QJsonObject filters = obj["filters"].toObject();
	state->setResultSort(filters["sort"].toString(),
	                     filters["desc"].toString() == "1");
	state->setResultLimit(obj["limit"].toInt());
}