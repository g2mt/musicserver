#pragma once

#ifdef MS_ENABLE_MPRIS

#include <QObject>

class Mpris : public QObject {
public:
  explicit Mpris(QObject *parent = nullptr);
};

#endif
