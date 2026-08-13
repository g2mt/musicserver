#pragma once

#ifdef MS_ENABLE_MPRIS

#include <QByteArray>
#include <QObject>
#include <QString>

class Mpris : public QObject {
  Q_OBJECT
public:
  explicit Mpris(QObject *parent = nullptr);

  void setCover(const QByteArray &bytes);
signals:
  void coverChanged(const QString &uri);
};

#endif
