#pragma once

#include <QStyledItemDelegate>

class TrackDelegate : public QStyledItemDelegate {
  Q_OBJECT
public:
  explicit TrackDelegate(QObject *parent = nullptr);

  void paint(QPainter *painter, const QStyleOptionViewItem &option,
             const QModelIndex &index) const override;
  QSize sizeHint(const QStyleOptionViewItem &option,
                 const QModelIndex &index) const override;

  int highlightedRow = -1;
  QSize coverSize = QSize(48, 48);
};