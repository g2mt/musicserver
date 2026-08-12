#pragma once

#include <QFuture>
#include <QJsonDocument>
#include <QJsonObject>
#include <QObject>
#include <QString>

#include "TrackData.h"

struct MsrvNewInterfaceResult;
struct MsrvHandleRequestResult;
struct MsrvReadAllResult;
struct MsrvLoadTrackByPathResult;

class ApiClient : public QObject {
  Q_OBJECT
public:
  explicit ApiClient(QObject *parent = nullptr);
  ~ApiClient() override;

  bool initializeFromConfigFile(const QString &configPath);

  QFuture<QJsonDocument>
  handleRequest(const QString &path, const QString &method,
                const QJsonObject &params = QJsonObject());
  QFuture<QJsonDocument> get(const QString &path,
                             const QJsonObject &params = QJsonObject());
  QFuture<QJsonDocument> post(const QString &path,
                              const QJsonObject &params = QJsonObject());
  QFuture<QJsonDocument> del(const QString &path,
                             const QJsonObject &params = QJsonObject());
  QFuture<QJsonDocument> getProgress();
  QFuture<TrackData> loadTrackByPath(const QString &encodedPath);
  QFuture<void> scanTracks(const QString &path, bool force);

private:
  QJsonDocument doRequest(const QString &path, const QString &method,
                          const QJsonObject &params);

  uintptr_t m_ifaceHandle = 0;
};