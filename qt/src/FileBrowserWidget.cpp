#include "FileBrowserWidget.h"

#include "ApiClient.h"
#include "AppState.h"

#include <QAbstractItemView>
#include <QDebug>
#include <QIcon>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMenu>
#include <QTimer>
#include <QTreeWidgetItem>
#include <QUrl>
#include <QVBoxLayout>

static QIcon themeIcon(const QString &name, const QString &fallback) {
  QIcon icon = QIcon::fromTheme(name);
  if (icon.isNull())
    return QIcon::fromTheme(fallback);
  return icon;
}

FileBrowserWidget::FileBrowserWidget(QWidget *parent)
    : QWidget(parent), m_api(ApiClient::instance()) {
  setupUi();

  m_listingWatcher = new QFutureWatcher<QJsonDocument>(this);
  connect(m_listingWatcher, &QFutureWatcher<QJsonDocument>::finished, this,
          &FileBrowserWidget::onListingFinished);

  m_trackWatcher = new QFutureWatcher<TrackData>(this);
  connect(m_trackWatcher, &QFutureWatcher<TrackData>::finished, this,
          &FileBrowserWidget::onTrackLoaded);

  m_scanWatcher = new QFutureWatcher<void>(this);
  connect(m_scanWatcher, &QFutureWatcher<void>::finished, this,
          &FileBrowserWidget::onScanFinished);

  AppState *state = AppState::instance();
  connect(state, &AppState::fbPathChanged, this, &FileBrowserWidget::refresh);
  connect(state, &AppState::serverPropsChanged, this,
          &FileBrowserWidget::refresh);
}

void FileBrowserWidget::setupUi() {
  auto *layout = new QVBoxLayout(this);
  layout->setContentsMargins(0, 0, 0, 0);

  m_breadcrumb = new QLabel();
  m_breadcrumb->setTextFormat(Qt::RichText);
  m_breadcrumb->setTextInteractionFlags(Qt::TextBrowserInteraction);
  connect(m_breadcrumb, &QLabel::linkActivated, this,
          [this](const QString &link) {
            AppState *state = AppState::instance();
            if (link == "root") {
              state->setFbPath({});
              return;
            }
            bool ok = false;
            const int index = link.toInt(&ok);
            if (!ok)
              return;
            const QStringList path = state->fbPath();
            if (index >= 0 && index < path.size()) {
              state->setFbPath(path.mid(0, index + 1));
            }
          });
  layout->addWidget(m_breadcrumb);

  m_tree = new QTreeWidget();
  m_tree->setColumnCount(1);
  m_tree->setHeaderHidden(true);
  m_tree->setRootIsDecorated(false);
  m_tree->setUniformRowHeights(true);
  m_tree->setAlternatingRowColors(true);
  m_tree->setSelectionMode(QAbstractItemView::SingleSelection);
  m_tree->setContextMenuPolicy(Qt::CustomContextMenu);

  connect(m_tree, &QTreeWidget::itemActivated, this,
          &FileBrowserWidget::handleItemActivated);
  connect(m_tree, &QTreeWidget::customContextMenuRequested, this,
          &FileBrowserWidget::showContextMenu);

  layout->addWidget(m_tree);
}

QString FileBrowserWidget::dataPath() const {
  const QJsonObject props = AppState::instance()->serverProps();
  return props["config"].toObject()["data_path"].toString();
}

void FileBrowserWidget::refresh() {
  const QString root = dataPath();
  if (root.isEmpty())
    return;

  m_tree->clear();

  const QStringList fbPath = AppState::instance()->fbPath();

  QStringList segments;
  segments.append(QUrl::toPercentEncoding(root));
  for (const QString &segment : fbPath) {
    segments.append(QUrl::toPercentEncoding(segment));
  }
  const QString encodedPath = segments.join("/");

  m_listingWatcher->setFuture(m_api->get("/file/" + encodedPath));
  updateBreadcrumb();
}

void FileBrowserWidget::updateBreadcrumb() {
  const QStringList fbPath = AppState::instance()->fbPath();
  QStringList parts;
  parts.append(QStringLiteral("<a href=\"root\">root</a>"));
  for (int i = 0; i < fbPath.size(); ++i) {
    parts.append(QStringLiteral("<a href=\"%1\">%2</a>")
                     .arg(i)
                     .arg(fbPath.at(i).toHtmlEscaped()));
  }
  m_breadcrumb->setText(parts.join(" / "));
}

QString FileBrowserWidget::relativePathForItem(QTreeWidgetItem *item) const {
  QStringList relative = AppState::instance()->fbPath();
  relative.append(item->data(0, Qt::UserRole + 1).toString());
  return relative.join("/");
}

QString
FileBrowserWidget::encodedTrackPathForItem(QTreeWidgetItem *item) const {
  QStringList segments = AppState::instance()->fbPath();
  segments.append(item->data(0, Qt::UserRole + 1).toString());

  QStringList encoded;
  for (const QString &segment : segments) {
    encoded.append(QUrl::toPercentEncoding(segment));
  }
  return encoded.join("/");
}

void FileBrowserWidget::onListingFinished() {
  const QJsonDocument doc = m_listingWatcher->result();
  m_tree->clear();

  if (!doc.isObject())
    return;

  const QJsonObject obj = doc.object();
  const QJsonArray directories = obj["directories"].toArray();
  const QJsonArray files = obj["files"].toArray();

  if (!AppState::instance()->fbPath().isEmpty()) {
    auto *upItem = new QTreeWidgetItem(m_tree);
    upItem->setText(0, "..");
    upItem->setIcon(0, themeIcon("go-up", "folder"));
    upItem->setData(0, Qt::UserRole, "parent");
  }

  for (const auto &value : directories) {
    const QString name = value.toString();
    auto *item = new QTreeWidgetItem(m_tree);
    item->setText(0, name);
    item->setIcon(0, themeIcon("folder", "folder"));
    item->setData(0, Qt::UserRole, "dir");
    item->setData(0, Qt::UserRole + 1, name);
  }

  for (const auto &value : files) {
    const QString name = value.toString();
    auto *item = new QTreeWidgetItem(m_tree);
    item->setText(0, name);
    item->setIcon(0, themeIcon("audio-x-generic", "text-x-generic"));
    item->setData(0, Qt::UserRole, "file");
    item->setData(0, Qt::UserRole + 1, name);
  }
}

void FileBrowserWidget::handleItemActivated(QTreeWidgetItem *item,
                                            int column) {
  Q_UNUSED(column);
  if (!item)
    return;

  const QString type = item->data(0, Qt::UserRole).toString();
  const QString name = item->data(0, Qt::UserRole + 1).toString();

  if (type == "parent") {
    QTimer::singleShot(0, this, [this]() {
      AppState *state = AppState::instance();
      const QStringList fbPath = state->fbPath();
      state->setFbPath(fbPath.mid(0, fbPath.size() - 1));
    });
    return;
  }

  if (type == "dir") {
    QTimer::singleShot(0, this, [this, name]() {
      AppState *state = AppState::instance();
      QStringList next = state->fbPath();
      next.append(name);
      state->setFbPath(next);
    });
    return;
  }

  if (type == "file") {
    const QString encoded = encodedTrackPathForItem(item);
    m_trackWatcher->setFuture(m_api->loadTrackByPath(encoded));
  }
}

void FileBrowserWidget::showContextMenu(const QPoint &pos) {
  QTreeWidgetItem *item = m_tree->itemAt(pos);
  if (!item)
    return;

  m_tree->setCurrentItem(item);

  const QString type = item->data(0, Qt::UserRole).toString();
  if (type != "dir" && type != "file")
    return;

  const QString relativePath = relativePathForItem(item);

  QMenu menu;
  if (type == "dir") {
    menu.addAction(QIcon::fromTheme("system-search"), "Show tracks in this path",
                   this, [this, relativePath]() {
                     emit showTracksInPath(relativePath);
                   });
    menu.addAction(QIcon::fromTheme("view-refresh"), "Scan this path", this,
                   [this, relativePath]() {
                     m_scanWatcher->setFuture(
                         m_api->scanTracks(relativePath, false));
                   });
  } else {
    const QString encoded = encodedTrackPathForItem(item);
    menu.addAction(QIcon::fromTheme("media-playback-start"), "Play", this,
                   [this, encoded]() {
                     m_trackWatcher->setFuture(
                         m_api->loadTrackByPath(encoded));
                   });
  }

  menu.exec(m_tree->viewport()->mapToGlobal(pos));
}

void FileBrowserWidget::onTrackLoaded() {
  const TrackData track = m_trackWatcher->result();
  if (track.path.isEmpty() && track.id.isEmpty()) {
    emit statusMessage("Failed to load track");
    return;
  }

  AppState *state = AppState::instance();
  state->setCurrentTrack(track);
  state->setIsPlaying(true);
}

void FileBrowserWidget::onScanFinished() {
  emit statusMessage("Scan complete");
}
