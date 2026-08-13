#pragma once

#include <QFutureWatcher>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMap>
#include <QString>
#include <QTimer>
#include <QWidget>

class ApiClient;
class QTableWidget;

class ProgressWidget : public QWidget {
  Q_OBJECT
public:
  explicit ProgressWidget(QWidget *parent = nullptr);

private slots:
  void poll();
  void onProgressFinished();

private:
  void setupUi();
  void rebuild(const QJsonObject &progresses);

  ApiClient *m_api = nullptr;
  QTableWidget *m_table = nullptr;
  QTimer *m_timer = nullptr;
  QFutureWatcher<QJsonDocument> *m_watcher = nullptr;
  QJsonObject m_lastProgresses;
  QMap<QString, bool> m_expanded;
};
