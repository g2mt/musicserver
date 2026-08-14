#include "BookmarksWidget.h"

#include "AppState.h"

#include <QAbstractItemView>
#include <QHBoxLayout>
#include <QIcon>
#include <QInputDialog>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMenu>
#include <QPushButton>
#include <QTimer>
#include <QVBoxLayout>

BookmarksWidget::BookmarksWidget(QWidget *parent) : QWidget(parent) {
  setupUi();

  AppState *state = AppState::instance();
  connect(state, &AppState::bookmarksChanged, this, &BookmarksWidget::rebuild);
  connect(state, &AppState::searchQueryChanged, this,
          [this](const QString &query, bool) {
            m_addButton->setEnabled(!query.isEmpty());
          });

  m_addButton->setEnabled(!state->searchQuery().isEmpty());
  rebuild();
}

void BookmarksWidget::setupUi() {
  auto *layout = new QVBoxLayout(this);
  layout->setContentsMargins(0, 0, 0, 0);

  auto *addRow = new QWidget(this);
  auto *addLayout = new QHBoxLayout(addRow);
  addLayout->setContentsMargins(0, 0, 0, 0);

  m_nameInput = new QLineEdit(addRow);
  m_nameInput->setPlaceholderText("Bookmark name");
  connect(m_nameInput, &QLineEdit::returnPressed, this,
          &BookmarksWidget::onAdd);

  m_addButton = new QPushButton(QIcon::fromTheme("list-add"), "Add", addRow);
  connect(m_addButton, &QPushButton::clicked, this, &BookmarksWidget::onAdd);

  addLayout->addWidget(m_nameInput, 1);
  addLayout->addWidget(m_addButton);
  layout->addWidget(addRow, 0);

  m_emptyLabel = new QLabel("No bookmarks", this);
  m_emptyLabel->setAlignment(Qt::AlignCenter);
  layout->addWidget(m_emptyLabel, 1);

  m_list = new QListWidget(this);
  m_list->setSelectionMode(QAbstractItemView::NoSelection);
  m_list->setVerticalScrollMode(QAbstractItemView::ScrollPerPixel);
  layout->addWidget(m_list, 1);
}

QWidget *BookmarksWidget::createBookmarkRow(const Bookmark &bm, int index) {
  auto *row = new QWidget();
  auto *layout = new QHBoxLayout(row);
  layout->setContentsMargins(0, 0, 0, 0);

  QString text = bm.name;
  if (!bm.name.isEmpty() && !bm.query.isEmpty())
    text += "\n";
  text += bm.query;

  auto *content = new QPushButton(text, row);
  content->setFlat(true);
  content->setStyleSheet("text-align: left;");
  content->setCursor(Qt::PointingHandCursor);
  content->setToolTip(bm.query);
  content->setContextMenuPolicy(Qt::CustomContextMenu);
  connect(content, &QPushButton::clicked, this,
          [this, bm]() { emit openBookmark(bm.query); });
  connect(content, &QPushButton::customContextMenuRequested, this,
          [this, bm, index, content](const QPoint &pos) {
            showRowContextMenu(bm, index, content->mapToGlobal(pos));
          });

  auto *removeBtn = new QPushButton(QIcon::fromTheme("list-remove"), "", row);
  removeBtn->setToolTip("Remove bookmark");
  removeBtn->setContextMenuPolicy(Qt::CustomContextMenu);
  connect(removeBtn, &QPushButton::clicked, this, [this, index]() {
    QTimer::singleShot(0, this, [this, index]() {
      AppState::instance()->removeBookmark(index);
    });
  });
  connect(removeBtn, &QPushButton::customContextMenuRequested, this,
          [this, bm, index, removeBtn](const QPoint &pos) {
            showRowContextMenu(bm, index, removeBtn->mapToGlobal(pos));
          });

  layout->addWidget(content, 1);
  layout->addWidget(removeBtn);
  return row;
}

void BookmarksWidget::rebuild() {
  m_list->clear();

  const QList<Bookmark> bookmarks = AppState::instance()->bookmarks();
  m_emptyLabel->setVisible(bookmarks.isEmpty());
  m_list->setVisible(!bookmarks.isEmpty());

  for (int i = 0; i < bookmarks.size(); ++i) {
    auto *item = new QListWidgetItem(m_list);
    QWidget *row = createBookmarkRow(bookmarks.at(i), i);
    item->setSizeHint(row->sizeHint());
    m_list->setItemWidget(item, row);
  }
}

void BookmarksWidget::onAdd() {
  AppState *state = AppState::instance();
  const QString query = state->searchQuery();
  if (query.isEmpty())
    return;

  Bookmark bm;
  bm.name = m_nameInput->text().trimmed();
  bm.query = query;
  state->addBookmark(bm);
  m_nameInput->clear();
  emit statusMessage("Bookmark added");
}

void BookmarksWidget::showRowContextMenu(const Bookmark &bm, int index,
                                         const QPoint &globalPos) {
  QMenu menu(this);
  menu.addAction(QIcon::fromTheme("document-edit"), "Rename", this,
                 [this, bm, index]() { renameBookmark(bm, index); });
  menu.addAction(
      QIcon::fromTheme("edit-delete"), "Delete", this,
      [this, index]() { AppState::instance()->removeBookmark(index); });
  menu.exec(globalPos);
}

void BookmarksWidget::renameBookmark(const Bookmark &bm, int index) {
  bool ok = false;
  const QString newName =
      QInputDialog::getText(this, "Rename bookmark",
                            "Bookmark name:", QLineEdit::Normal, bm.name, &ok);
  if (!ok)
    return;

  QList<Bookmark> bookmarks = AppState::instance()->bookmarks();
  if (index < 0 || index >= bookmarks.size())
    return;
  bookmarks[index].name = newName.trimmed();
  AppState::instance()->setBookmarks(bookmarks);
  emit statusMessage("Bookmark renamed");
}
