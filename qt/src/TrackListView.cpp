#include "TrackListView.h"

#include "ApiClient.h"
#include "AppState.h"
#include "TrackDelegate.h"
#include "TrackListModel.h"

#include <QApplication>
#include <QByteArray>
#include <QClipboard>
#include <QFuture>
#include <QFutureWatcher>
#include <QHBoxLayout>
#include <QIcon>
#include <QListView>
#include <QMenu>
#include <QPixmap>
#include <QSizePolicy>
#include <QToolBar>
#include <QVBoxLayout>
#include <QVariant>

TrackListView::TrackListView(Action action, QWidget *parent)
    : QWidget(parent), m_action(action) {
  setupUi();
}

void TrackListView::setupUi() {
  QVBoxLayout *layout = new QVBoxLayout(this);
  layout->setContentsMargins(0, 0, 0, 0);

  if (m_action == Action::Unqueue) {
    QToolBar *actions = new QToolBar(this);
    actions->setMovable(false);
    actions->setFloatable(false);
    actions->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);

    QAction *removeAllAction =
        actions->addAction(QIcon::fromTheme("edit-clear-all"), "Remove All");
    QAction *shuffleAction = actions->addAction(
        QIcon::fromTheme("media-playlist-shuffle"), "Shuffle");
    connect(removeAllAction, &QAction::triggered, this,
            &TrackListView::removeAllRequested);
    connect(shuffleAction, &QAction::triggered, this,
            &TrackListView::shuffleRequested);

    QWidget *spacer = new QWidget();
    spacer->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
    actions->addWidget(spacer);
    layout->addWidget(actions);
  }

  m_view = new QListView(this);
  m_model = new TrackListModel(this);
  m_view->setModel(m_model);

  TrackDelegate *delegate = new TrackDelegate(this);
  delegate->setModel(m_model);
  delegate->setAction(m_action == Action::Enqueue
                          ? TrackDelegate::Action::Enqueue
                          : TrackDelegate::Action::Unqueue);
  m_view->setItemDelegate(delegate);
  m_view->setUniformItemSizes(true);
  m_view->setAlternatingRowColors(true);
  m_view->setContextMenuPolicy(Qt::CustomContextMenu);
  layout->addWidget(m_view);

  connect(delegate, &TrackDelegate::trackActionClicked, this, [this](int row) {
    if (row < 0 || row >= m_model->tracks().size())
      return;
    if (m_action == Action::Enqueue)
      emit enqueueRequested(m_model->tracks().at(row));
    else
      emit unqueueRequested(row);
  });

  connect(m_view, &QListView::doubleClicked, this,
          [this](const QModelIndex &index) {
            TrackData track = qvariant_cast<TrackData>(
                index.data(TrackListModel::TrackDataRole));
            emit playRequested(track, index.row());
          });

  connect(
      m_view, &QListView::customContextMenuRequested, this,
      [this](const QPoint &pos) {
        QModelIndex index = m_view->indexAt(pos);
        if (!index.isValid())
          return;
        TrackData track =
            qvariant_cast<TrackData>(index.data(TrackListModel::TrackDataRole));
        const int row = index.row();

        QMenu menu(this);
        menu.addAction(
            QIcon::fromTheme("media-playback-start"), "Play", this,
            [this, track, row]() { emit playRequested(track, row); });
        if (m_action == Action::Enqueue) {
          menu.addAction(QIcon::fromTheme("list-add"), "Add to Queue", this,
                         [this, track]() { emit enqueueRequested(track); });
        } else {
          menu.addAction("Remove", this,
                         [this, row]() { emit unqueueRequested(row); });
        }
        menu.addAction(QIcon::fromTheme("edit-copy"), "Copy Info", this,
                       [track]() {
                         QApplication::clipboard()->setText(
                             QString("%1 - %2").arg(track.name, track.artist));
                       });

        QMenu *goToMenu = menu.addMenu("Go to...");
        if (!track.album.isEmpty()) {
          goToMenu->addAction(QIcon::fromTheme("media-optical"), "Album", this,
                              [this, track]() {
                                emit searchRequested(
                                    QString("album:\"%1\"").arg(track.album));
                              });
        }
        if (!track.artist.isEmpty()) {
          goToMenu->addAction(QIcon::fromTheme("user-identity"), "Artist", this,
                              [this, track]() {
                                emit searchRequested(
                                    QString("artist:\"%1\"").arg(track.artist));
                              });
        }
        goToMenu->addAction(QIcon::fromTheme("folder"), "Path", this,
                            [this, track]() {
                              QStringList parts = track.path.split("/");
                              parts.removeLast();
                              AppState::instance()->setFbPath(parts);
                              AppState::instance()->setLeftTab(LeftTab::Files);
                            });
        menu.addAction(QIcon::fromTheme("user-trash"), "Forget Track", this,
                       [this, track]() {
                         ApiClient::instance()
                             ->del(QString("/track/%1").arg(track.id))
                             .then([this, track](const QJsonDocument &) {
                               emit searchRequested(
                                   AppState::instance()->searchQuery());
                             });
                       });
        menu.exec(m_view->viewport()->mapToGlobal(pos));
      });

  connect(m_model, &TrackListModel::coverRequested, this,
          [this](int, const QString &trackId) { fetchCover(trackId); });
}

void TrackListView::fetchCover(const QString &trackId) {
  QFuture<QByteArray> future =
      ApiClient::instance()->getBytes(QString("/track/%1/cover").arg(trackId));
  auto *watcher = new QFutureWatcher<QByteArray>(this);
  connect(watcher, &QFutureWatcher<QByteArray>::finished, this,
          [this, watcher, trackId]() {
            QByteArray bytes = watcher->result();
            watcher->deleteLater();
            QPixmap pix;
            if (!bytes.isEmpty() && pix.loadFromData(bytes))
              m_model->setCoverPixmap(trackId, pix);
          });
  watcher->setFuture(future);
}

void TrackListView::setTracks(const QList<TrackData> &tracks) {
  m_model->setTracks(tracks);
}

void TrackListView::insertTracks(const QList<TrackData> &tracks,
                                 int startIndex) {
  m_model->insertTracks(tracks, startIndex);
}

void TrackListView::removeTracks(int startIndex, int count) {
  m_model->removeTracks(startIndex, count);
}

const QList<TrackData> &TrackListView::tracks() const {
  return m_model->tracks();
}

void TrackListView::setHighlightedTrackId(const QString &id) {
  m_view->selectionModel()->clear();
  m_model->setHighlightedTrackId(id);
}

QString TrackListView::highlightedTrackId() const {
  return m_model->highlightedTrackId();
}

void TrackListView::scrollToTop() { m_view->scrollToTop(); }
