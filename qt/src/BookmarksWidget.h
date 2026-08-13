#pragma once

#include <QWidget>

#include "Bookmark.h"

class QLineEdit;
class QListWidget;
class QLabel;
class QPushButton;

class BookmarksWidget : public QWidget {
  Q_OBJECT
public:
  explicit BookmarksWidget(QWidget *parent = nullptr);

signals:
  void openBookmark(const QString &query);
  void statusMessage(const QString &message);

private slots:
  void rebuild();
  void onAdd();

private:
  void setupUi();
  QWidget *createBookmarkRow(const Bookmark &bm, int index);
  void showRowContextMenu(const Bookmark &bm, int index,
                          const QPoint &globalPos);
  void renameBookmark(const Bookmark &bm, int index);

  QLineEdit *m_nameInput = nullptr;
  QPushButton *m_addButton = nullptr;
  QLabel *m_emptyLabel = nullptr;
  QListWidget *m_list = nullptr;
};
