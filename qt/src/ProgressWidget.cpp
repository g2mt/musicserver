#include "ProgressWidget.h"

#include "ApiClient.h"

#include <QAbstractItemView>
#include <QHeaderView>
#include <QJsonObject>
#include <QPlainTextEdit>
#include <QProgressBar>
#include <QPushButton>
#include <QStringList>
#include <QTableWidget>
#include <QVBoxLayout>

ProgressWidget::ProgressWidget(QWidget *parent)
    : QWidget(parent), m_api(ApiClient::instance()) {
  setupUi();

  m_watcher = new QFutureWatcher<QJsonDocument>(this);
  connect(m_watcher, &QFutureWatcher<QJsonDocument>::finished, this,
          &ProgressWidget::onProgressFinished);

  m_timer = new QTimer(this);
  m_timer->setInterval(500);
  connect(m_timer, &QTimer::timeout, this, &ProgressWidget::poll);
  m_timer->start();

  poll();
}

void ProgressWidget::setupUi() {
  auto *layout = new QVBoxLayout(this);
  layout->setContentsMargins(0, 0, 0, 0);

  m_table = new QTableWidget(this);
  m_table->setColumnCount(3);
  m_table->setHorizontalHeaderLabels(
      {tr("Name"), tr("Progress"), tr("Output")});
  m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
  m_table->setSelectionMode(QAbstractItemView::NoSelection);
  m_table->verticalHeader()->setVisible(false);
  m_table->horizontalHeader()->setSectionResizeMode(0,
                                                    QHeaderView::Stretch);
  m_table->horizontalHeader()->setSectionResizeMode(1,
                                                    QHeaderView::Fixed);
  m_table->horizontalHeader()->resizeSection(1, 160);
  m_table->horizontalHeader()->setSectionResizeMode(2,
                                                    QHeaderView::ResizeToContents);
  layout->addWidget(m_table);
}

void ProgressWidget::poll() {
  if (m_watcher->isRunning())
    return;
  m_watcher->setFuture(m_api->getProgress());
}

void ProgressWidget::onProgressFinished() {
  const QJsonDocument doc = m_watcher->result();
  if (!doc.isObject())
    return;
  m_lastProgresses = doc.object();
  rebuild(m_lastProgresses);
}

void ProgressWidget::rebuild(const QJsonObject &progresses) {
  m_table->setRowCount(0);
  m_table->clearSpans();

  if (progresses.isEmpty()) {
    m_table->insertRow(0);
    auto *item = new QTableWidgetItem(tr("No active processes."));
    m_table->setItem(0, 0, item);
    m_table->setSpan(0, 0, 1, 3);
    return;
  }

  const QStringList names = progresses.keys();
  for (const QString &name : names) {
    const QJsonObject entry = progresses[name].toObject();
    const int value = entry["value"].toInt();
    const int maxValue = entry["max_value"].toInt();
    const bool expanded = m_expanded.value(name, false);

    const int row = m_table->rowCount();
    m_table->insertRow(row);

    m_table->setItem(row, 0, new QTableWidgetItem(name));

    auto *bar = new QProgressBar(m_table);
    bar->setRange(0, qMax(1, maxValue));
    bar->setValue(value);
    m_table->setCellWidget(row, 1, bar);

    auto *outputButton = new QPushButton(expanded ? tr("Hide") : tr("Show"),
                                         m_table);
    connect(outputButton, &QPushButton::clicked, this, [this, name]() {
      m_expanded[name] = !m_expanded.value(name, false);
      rebuild(m_lastProgresses);
    });
    m_table->setCellWidget(row, 2, outputButton);

    if (expanded) {
      const int outputRow = m_table->rowCount();
      m_table->insertRow(outputRow);
      auto *output = new QPlainTextEdit(m_table);
      output->setReadOnly(true);
      output->setPlainText(entry["output"].toString());
      output->setMaximumHeight(120);
      m_table->setCellWidget(outputRow, 0, output);
      m_table->setSpan(outputRow, 0, 1, 3);
    }
  }
}
