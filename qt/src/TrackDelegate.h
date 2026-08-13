#pragma once

#include <QStyledItemDelegate>

class QAbstractItemModel;
class QEvent;
class TrackListModel;

class TrackDelegate : public QStyledItemDelegate {
  Q_OBJECT
public:
  enum class Action { Enqueue, Unqueue };

  explicit TrackDelegate(QObject *parent = nullptr);

  void paint(QPainter *painter, const QStyleOptionViewItem &option,
             const QModelIndex &index) const override;
  QSize sizeHint(const QStyleOptionViewItem &option,
                 const QModelIndex &index) const override;
  bool editorEvent(QEvent *event, QAbstractItemModel *model,
                   const QStyleOptionViewItem &option,
                   const QModelIndex &index) override;

  void setModel(TrackListModel *model);
  void setAction(Action action);

  int highlightedRow = -1;
  QSize coverSize = QSize(48, 48);

signals:
  void trackActionClicked(int row);

private:
  QRect actionButtonRect(const QStyleOptionViewItem &option) const;

  TrackListModel *m_model = nullptr;
  Action m_action = Action::Enqueue;
};