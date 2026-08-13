#pragma once

#include <QFutureWatcher>
#include <QLabel>
#include <QTreeWidget>
#include <QWidget>

#include "TrackData.h"

class ApiClient;
class QTreeWidgetItem;

class FileBrowserWidget : public QWidget {
  Q_OBJECT
public:
  explicit FileBrowserWidget(QWidget *parent = nullptr);

signals:
  void showTracksInPath(const QString &relativePath);
  void statusMessage(const QString &message);

private slots:
  void refresh();
  void onListingFinished();
  void onTrackLoaded();
  void onScanFinished();

private:
  void setupUi();
  void updateBreadcrumb();
  void handleItemActivated(QTreeWidgetItem *item, int column);
  void showContextMenu(const QPoint &pos);
  QString dataPath() const;
  QString relativePathForItem(QTreeWidgetItem *item) const;
  QString encodedTrackPathForItem(QTreeWidgetItem *item) const;

  ApiClient *m_api = nullptr;
  QLabel *m_breadcrumb = nullptr;
  QTreeWidget *m_tree = nullptr;
  QFutureWatcher<QJsonDocument> *m_listingWatcher = nullptr;
  QFutureWatcher<TrackData> *m_trackWatcher = nullptr;
  QFutureWatcher<void> *m_scanWatcher = nullptr;
};
