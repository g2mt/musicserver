#include "FileBrowserWidget.h"

#include "ApiClient.h"
#include "AppState.h"

#include <QAbstractItemView>
#include <QDebug>
#include <QFrame>
#include <QLayout>
#include <QLayoutItem>
#include <QPushButton>
#include <functional>
#include <QIcon>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMenu>
#include <QSize>
#include <QTimer>
#include <QToolBar>
#include <QTreeWidgetItem>
#include <QUrl>
#include <utility>
#include <QVBoxLayout>

static QIcon themeIcon(const QString &name, const QString &fallback) {
  QIcon icon = QIcon::fromTheme(name);
  if (icon.isNull())
    return QIcon::fromTheme(fallback);
  return icon;
}

class FileBrowserLocationBarLayout : public QLayout {
public:
  explicit FileBrowserLocationBarLayout(QWidget *parent = nullptr) : QLayout(parent) {}

  ~FileBrowserLocationBarLayout() override {
    while (QLayoutItem *item = takeAt(0))
      delete item;
  }

  void addItem(QLayoutItem *item) override { m_items.append(item); }
  int count() const override { return m_items.size(); }
  QLayoutItem *itemAt(int index) const override {
    return index >= 0 && index < m_items.size() ? m_items.at(index) : nullptr;
  }
  QLayoutItem *takeAt(int index) override {
    return index >= 0 && index < m_items.size() ? m_items.takeAt(index)
                                                 : nullptr;
  }
  bool hasHeightForWidth() const override { return true; }
  int heightForWidth(int width) const override { return doLayout(width, true); }
  QSize sizeHint() const override { return minimumSize(); }
  QSize minimumSize() const override {
    QSize size;
    for (QLayoutItem *item : m_items)
      size = size.expandedTo(item->minimumSize());
    const QMargins margins = contentsMargins();
    return size + QSize(margins.left() + margins.right(),
                        margins.top() + margins.bottom());
  }

  void setGeometry(const QRect &rect) override {
    QLayout::setGeometry(rect);
    doLayout(rect.width(), false, rect);
  }

private:
  int doLayout(int width, bool testOnly, const QRect &rect = {}) const {
    const QMargins margins = contentsMargins();
    const int effectiveWidth = width - margins.left() - margins.right();
    int x = 0;
    int y = 0;
    int lineHeight = 0;

    for (QLayoutItem *item : m_items) {
      const QSize itemSize = item->sizeHint();
      const int spacing = x > 0 ? this->spacing() : 0;
      if (x > 0 && x + spacing + itemSize.width() > effectiveWidth) {
        x = 0;
        y += lineHeight;
        lineHeight = 0;
      }
      if (x > 0)
        x += spacing;
      if (!testOnly)
        item->setGeometry(QRect(rect.x() + margins.left() + x,
                                rect.y() + margins.top() + y, itemSize.width(),
                                itemSize.height()));
      x += itemSize.width();
      lineHeight = qMax(lineHeight, itemSize.height());
    }
    return y + lineHeight + margins.top() + margins.bottom();
  }

  QList<QLayoutItem *> m_items;
};

class FileBrowserLocationBar : public QFrame {
public:
  explicit FileBrowserLocationBar(QWidget *parent = nullptr) : QFrame(parent) {
    setStyleSheet(QStringLiteral(
        "FileBrowserLocationBar {"
        "  border: 1px solid palette(mid);"
        "  background: palette(base);"
        "}"
        "QPushButton {"
        "  padding: 2px 4px;"
        "}"
        "QPushButton:hover {"
        "  background: palette(alternate-base);"
        "}"));

    setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
    m_layout = new FileBrowserLocationBarLayout(this);
    m_layout->setContentsMargins(4, 1, 4, 1);
    m_layout->setSpacing(4);
  }

  void setPath(const QStringList &path) {
    while (QLayoutItem *item = m_layout->takeAt(0)) {
      if (QWidget *widget = item->widget())
        widget->deleteLater();
      delete item;
    }

    addButton(QStringLiteral("root"), -1);
    for (int i = 0; i < path.size(); ++i) {
      addButton(path.at(i), i);
    }
    updateGeometry();
  }

  void setPathClickedCallback(std::function<void(int)> callback) {
    m_pathClicked = std::move(callback);
  }

private:
  void addButton(const QString &text, int index) {
    constexpr int maxCharacters = 24;
    const QString displayedText =
        text.size() > maxCharacters
            ? text.left(maxCharacters - 3) + QStringLiteral("...")
            : text;
    auto *button = new QPushButton(displayedText, this);
    button->setToolTip(text);
    button->setCursor(Qt::PointingHandCursor);
    button->setSizePolicy(QSizePolicy::Maximum, QSizePolicy::Fixed);
    connect(button, &QPushButton::clicked, this,
            [this, index]() {
              if (m_pathClicked)
                m_pathClicked(index);
            });
    m_layout->addWidget(button);
  }

  FileBrowserLocationBarLayout *m_layout = nullptr;
  std::function<void(int)> m_pathClicked;
};

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
  layout->setSpacing(0);

  m_breadcrumb = new FileBrowserLocationBar();
  m_breadcrumb->setPathClickedCallback([](int index) {
    AppState *state = AppState::instance();
    if (index < 0) {
      state->setFbPath({});
      return;
    }
    const QStringList path = state->fbPath();
    if (index < path.size())
      state->setFbPath(path.mid(0, index + 1));
  });
  layout->addWidget(m_breadcrumb);

  m_toolbar = new QToolBar();
  m_toolbar->setMovable(false);
  m_toolbar->setFloatable(false);
  m_toolbar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
  m_showTracksAction =
      m_toolbar->addAction(themeIcon("system-search", "edit-find"),
                           "Show Tracks in This Path", this, [this]() {
                             const QString relativePath =
                                 AppState::instance()->fbPath().join("/");
                             emit showTracksInPath(relativePath);
                           });
  m_scanAction = m_toolbar->addAction(
      themeIcon("view-refresh", "view-refresh"), "Scan This Path", this,
      [this]() {
        const QString relativePath = AppState::instance()->fbPath().join("/");
        m_scanWatcher->setFuture(m_api->scanTracks(relativePath, false));
      });
  layout->addWidget(m_toolbar);

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

  layout->addWidget(m_tree, 1);
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
  m_breadcrumb->setPath(AppState::instance()->fbPath());
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

void FileBrowserWidget::handleItemActivated(QTreeWidgetItem *item, int column) {
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
    menu.addAction(
        QIcon::fromTheme("system-search"), "Show Tracks in This Path", this,
        [this, relativePath]() { emit showTracksInPath(relativePath); });
    menu.addAction(QIcon::fromTheme("view-refresh"), "Scan This Path", this,
                   [this, relativePath]() {
                     m_scanWatcher->setFuture(
                         m_api->scanTracks(relativePath, false));
                   });
  } else {
    const QString encoded = encodedTrackPathForItem(item);
    menu.addAction(QIcon::fromTheme("media-playback-start"), "Play", this,
                   [this, encoded]() {
                     m_trackWatcher->setFuture(m_api->loadTrackByPath(encoded));
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
