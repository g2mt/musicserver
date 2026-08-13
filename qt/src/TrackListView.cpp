#include "TrackListView.h"

#include "ApiClient.h"
#include "TrackDelegate.h"
#include "TrackListModel.h"

#include <QByteArray>
#include <QFuture>
#include <QFutureWatcher>
#include <QHBoxLayout>
#include <QIcon>
#include <QListView>
#include <QMenu>
#include <QPixmap>
#include <QPushButton>
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
    QWidget *actions = new QWidget(this);
    QHBoxLayout *actionsLayout = new QHBoxLayout(actions);
    actionsLayout->setContentsMargins(0, 0, 0, 0);

    QPushButton *removeAllBtn = new QPushButton("Remove all", actions);
    QPushButton *shuffleBtn = new QPushButton("Shuffle", actions);
    connect(removeAllBtn, &QPushButton::clicked, this,
            &TrackListView::removeAllRequested);
    connect(shuffleBtn, &QPushButton::clicked, this,
            &TrackListView::shuffleRequested);

    actionsLayout->addWidget(removeAllBtn);
    actionsLayout->addWidget(shuffleBtn);
    actionsLayout->addStretch();
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

  connect(m_view, &QListView::customContextMenuRequested, this,
          [this](const QPoint &pos) {
            QModelIndex index = m_view->indexAt(pos);
            if (!index.isValid())
              return;
            TrackData track = qvariant_cast<TrackData>(
                index.data(TrackListModel::TrackDataRole));
            const int row = index.row();

            QMenu menu(this);
            menu.addAction(
                QIcon::fromTheme("media-playback-start"), "Play", this,
                [this, track, row]() { emit playRequested(track, row); });
            if (m_action == Action::Enqueue) {
              menu.addAction(QIcon::fromTheme("list-add"), "Add to queue", this,
                             [this, track]() { emit enqueueRequested(track); });
            } else {
              menu.addAction("Remove", this,
                             [this, row]() { emit unqueueRequested(row); });
            }
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
  m_model->setHighlightedTrackId(id);
}

QString TrackListView::highlightedTrackId() const {
  return m_model->highlightedTrackId();
}

void TrackListView::scrollToTop() { m_view->scrollToTop(); }
