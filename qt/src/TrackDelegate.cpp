#include "TrackDelegate.h"
#include "TrackListModel.h"

#include <QDebug>
#include <QPainter>
#include <QPixmap>

TrackDelegate::TrackDelegate(QObject *parent) : QStyledItemDelegate(parent) {}

void TrackDelegate::paint(QPainter *painter, const QStyleOptionViewItem &option,
                          const QModelIndex &index) const {
  painter->save();

  bool isHighlighted = index.row() == highlightedRow;

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
  int textWidth = option.rect.right() - textX - 8;

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

  painter->restore();
}

QSize TrackDelegate::sizeHint(const QStyleOptionViewItem &option,
                              const QModelIndex &index) const {
  (void)option;
  (void)index;
  return QSize(0, 64);
}