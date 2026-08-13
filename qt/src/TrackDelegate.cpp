#include "TrackDelegate.h"
#include "TrackListModel.h"

#include <QAbstractItemModel>
#include <QDebug>
#include <QEvent>
#include <QIcon>
#include <QMouseEvent>
#include <QPainter>
#include <QPixmap>

TrackDelegate::TrackDelegate(QObject *parent) : QStyledItemDelegate(parent) {}

void TrackDelegate::setModel(TrackListModel *model) { m_model = model; }

void TrackDelegate::setAction(Action action) { m_action = action; }

QRect TrackDelegate::actionButtonRect(
    const QStyleOptionViewItem &option) const {
  const int size = 22;
  const int margin = 6;
  return QRect(option.rect.right() - margin - size,
               option.rect.top() + (option.rect.height() - size) / 2, size,
               size);
}

void TrackDelegate::paint(QPainter *painter, const QStyleOptionViewItem &option,
                          const QModelIndex &index) const {
  painter->save();

  bool isHighlighted =
      index.data(TrackListModel::HighlightedRole).toBool();

  // Background
  if (option.state & QStyle::State_Selected || isHighlighted) {
    painter->fillRect(option.rect, option.palette.highlight());
  } else if (index.row() % 2 == 0) {
    painter->fillRect(option.rect, option.palette.alternateBase());
  } else {
    painter->fillRect(option.rect, option.palette.base());
  }

  // Cover art
  QRect coverRect(option.rect.left() + 4,
                  option.rect.top() +
                      (option.rect.height() - coverSize.height()) / 2,
                  coverSize.width(), coverSize.height());

  if (m_model) {
    m_model->ensureCoverLoaded(index.row());
  }

  QPixmap cover =
      index.data(TrackListModel::CoverPixmapRole).value<QPixmap>();
  bool hasCover = false;
  if (!cover.isNull()) {
    painter->drawPixmap(coverRect,
                        cover.scaled(coverSize, Qt::KeepAspectRatio,
                                     Qt::SmoothTransformation));
    hasCover = true;
  }
  if (!hasCover) {
    painter->setPen(Qt::gray);
    painter->drawRect(coverRect);
    painter->drawText(coverRect, Qt::AlignCenter, "?");
  }

  // Text
  QFont nameFont = option.font;
  nameFont.setPointSize(nameFont.pointSize() + 2);
  nameFont.setBold(true);
  QFont subFont = option.font;

  int textX = coverRect.right() + 8;
  QRect buttonRect = actionButtonRect(option);
  int textWidth = qMax(0, buttonRect.left() - 8 - textX);

  painter->setFont(nameFont);
  QString name = index.data(TrackListModel::NameRole).toString();
  QRect nameRect(textX, coverRect.top(), textWidth, option.rect.height() / 2);
  painter->drawText(
      nameRect, Qt::AlignLeft | Qt::AlignBottom,
      painter->fontMetrics().elidedText(name, Qt::ElideRight, textWidth));

  painter->setFont(subFont);
  painter->setPen(option.palette.color(QPalette::Disabled, QPalette::Text));

  QString artist = index.data(TrackListModel::ArtistRole).toString();
  QString album = index.data(TrackListModel::AlbumRole).toString();
  QString subText;
  if (!album.isEmpty() && !artist.isEmpty())
    subText = album + " — " + artist;
  else if (!artist.isEmpty())
    subText = artist;
  else
    subText = album;

  QRect subRect(textX, nameRect.bottom(), textWidth, option.rect.height() / 2);
  painter->drawText(
      subRect, Qt::AlignLeft | Qt::AlignTop,
      painter->fontMetrics().elidedText(subText, Qt::ElideRight, textWidth));

  // Enqueue (+) / unqueue (-) action button
  QIcon actionIcon = m_action == Action::Enqueue
                         ? QIcon::fromTheme("list-add")
                         : QIcon::fromTheme("list-remove");
  painter->setPen(Qt::gray);
  painter->setBrush(option.palette.button());
  painter->drawRoundedRect(buttonRect, 4, 4);
  if (actionIcon.isNull()) {
    painter->drawText(buttonRect, Qt::AlignCenter,
                      m_action == Action::Enqueue ? "+" : "-");
  } else {
    actionIcon.paint(painter, buttonRect.adjusted(3, 3, -3, -3));
  }

  painter->restore();
}

bool TrackDelegate::editorEvent(QEvent *event, QAbstractItemModel *model,
                                const QStyleOptionViewItem &option,
                                const QModelIndex &index) {
  if (event->type() == QEvent::MouseButtonRelease) {
    auto *mouse = static_cast<QMouseEvent *>(event);
    if (mouse->button() == Qt::LeftButton &&
        actionButtonRect(option).contains(mouse->pos())) {
      emit trackActionClicked(index.row());
      return true;
    }
  }
  return QStyledItemDelegate::editorEvent(event, model, option, index);
}

QSize TrackDelegate::sizeHint(const QStyleOptionViewItem &option,
                              const QModelIndex &index) const {
  (void)option;
  (void)index;
  return QSize(0, 64);
}