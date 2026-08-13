#include "SettingsWidget.h"

#include "ApiClient.h"
#include "AppState.h"
#include "ProgressWidget.h"

#include <QCheckBox>
#include <QFormLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QIcon>
#include <QLabel>
#include <QLineEdit>
#include <QList>
#include <QPushButton>
#include <QScrollArea>
#include <QSlider>
#include <QSpinBox>
#include <QVBoxLayout>

static QString sliderValueText(int raw, int decimals) {
  double value = static_cast<double>(raw);
  for (int i = 0; i < decimals; ++i) {
    value /= 10.0;
  }
  return QString::number(value, 'f', decimals) + " dB";
}

SettingsWidget::SettingsWidget(QWidget *parent)
    : QWidget(parent), m_api(ApiClient::instance()) {
  setupUi();

  m_scanWatcher = new QFutureWatcher<void>(this);
  connect(m_scanWatcher, &QFutureWatcher<void>::finished, this,
          &SettingsWidget::onRescanFinished);

  AppState *state = AppState::instance();

  connect(state, &AppState::amplificationChanged, this, [this](double db) {
    m_amplificationSlider->setValue(qRound(db * 10.0));
    m_amplificationValue->setText(
        sliderValueText(m_amplificationSlider->value(), 1));
  });
  connect(state, &AppState::normalizeChanged, this,
          [this](bool norm) { m_normalizeCheck->setChecked(norm); });
  connect(state, &AppState::shuffleBeforePlayingAllChanged, this,
          [this](bool shuffle) {
            m_shuffleBeforePlayingAllCheck->setChecked(shuffle);
          });
  connect(state, &AppState::targetNormalizationDbsChanged, this,
          [this](double db) {
            m_targetNormalizationSlider->setValue(qRound(db * 10.0));
            m_targetNormalizationValue->setText(
                sliderValueText(m_targetNormalizationSlider->value(), 1));
          });
  connect(state, &AppState::maxNormalizationDbsChanged, this,
          [this](double db) {
            m_maxNormalizationSlider->setValue(qRound(db * 10.0));
            m_maxNormalizationValue->setText(
                sliderValueText(m_maxNormalizationSlider->value(), 1));
          });
  connect(state, &AppState::searchHistoryLimitChanged, this,
          [this](int limit) { m_searchHistoryLimitSpin->setValue(limit); });
  connect(state, &AppState::darkModeChanged, this,
          [this](bool dark) { m_darkModeCheck->setChecked(dark); });
  connect(state, &AppState::serverPropsChanged, this,
          &SettingsWidget::updateServerProps);

  updateFromState();
  updateServerProps(state->serverProps());
}

void SettingsWidget::setupUi() {
  auto *outer = new QVBoxLayout(this);
  outer->setContentsMargins(0, 0, 0, 0);

  auto *scroll = new QScrollArea(this);
  scroll->setWidgetResizable(true);

  auto *content = new QWidget();
  auto *layout = new QVBoxLayout(content);
  layout->setContentsMargins(8, 8, 8, 8);
  layout->setSpacing(8);

  // Playback
  QWidget *playbackBody = nullptr;
  QGroupBox *playbackSection = makeSection(tr("Playback"), &playbackBody);
  layout->addWidget(playbackSection);
  playbackBody->layout()->addWidget(
      makeSliderRow(tr("Amplification (dB):"), -200, 200,
                    &m_amplificationSlider, &m_amplificationValue));
  m_normalizeCheck = new QCheckBox(tr("Normalize audio"), playbackBody);
  playbackBody->layout()->addWidget(m_normalizeCheck);

  connect(m_amplificationSlider, &QSlider::valueChanged, this,
          [this](int value) {
            m_amplificationValue->setText(sliderValueText(value, 1));
            AppState::instance()->setAmplification(value / 10.0);
          });
  connect(m_normalizeCheck, &QCheckBox::toggled, this, [this](bool checked) {
    AppState::instance()->setNormalize(checked);
  });

  // General settings
  QWidget *generalBody = nullptr;
  QGroupBox *generalSection = makeSection(tr("General Settings"), &generalBody);
  layout->addWidget(generalSection);

  m_shuffleBeforePlayingAllCheck =
      new QCheckBox(tr("Shuffle before playing all tracks"), generalBody);

  generalBody->layout()->addWidget(m_shuffleBeforePlayingAllCheck);

  generalBody->layout()->addWidget(
      makeSliderRow(tr("Target Normalization (dB):"), -200, 200,
                    &m_targetNormalizationSlider, &m_targetNormalizationValue));
  generalBody->layout()->addWidget(
      makeSliderRow(tr("Max Normalization (dB):"), -200, 200,
                    &m_maxNormalizationSlider, &m_maxNormalizationValue));

  auto *historyRow = new QWidget(generalBody);
  auto *historyLayout = new QHBoxLayout(historyRow);
  historyLayout->setContentsMargins(0, 0, 0, 0);
  historyLayout->addWidget(new QLabel(tr("Search history limit:")));
  historyLayout->addStretch();
  m_searchHistoryLimitSpin = new QSpinBox(historyRow);
  m_searchHistoryLimitSpin->setRange(0, 9999);
  historyLayout->addWidget(m_searchHistoryLimitSpin);
  generalBody->layout()->addWidget(historyRow);

  auto *buttonsRow = new QWidget(generalBody);
  auto *buttonsLayout = new QHBoxLayout(buttonsRow);
  buttonsLayout->setContentsMargins(0, 0, 0, 0);
  m_saveButton = new QPushButton(tr("Save"), buttonsRow);
  m_saveButton->setIcon(QIcon::fromTheme("document-save"));
  m_darkModeCheck = new QCheckBox(tr("Dark Mode (placeholder)"), buttonsRow);
  buttonsLayout->addWidget(m_saveButton);
  buttonsLayout->addWidget(m_darkModeCheck);
  buttonsLayout->addStretch();
  generalBody->layout()->addWidget(buttonsRow);

  auto *rescanRow = new QWidget(generalBody);
  auto *rescanLayout = new QHBoxLayout(rescanRow);
  rescanLayout->setContentsMargins(0, 0, 0, 0);
  m_rescanButton = new QPushButton(tr("Rescan Music"), rescanRow);
  m_rescanButton->setIcon(QIcon::fromTheme("view-refresh"));
  m_forceRescanButton =
      new QPushButton(tr("Rescan Music (Force Update)"), rescanRow);
  m_forceRescanButton->setIcon(QIcon::fromTheme("view-refresh"));
  rescanLayout->addWidget(m_rescanButton);
  rescanLayout->addWidget(m_forceRescanButton);
  rescanLayout->addStretch();
  generalBody->layout()->addWidget(rescanRow);

  connect(m_shuffleBeforePlayingAllCheck, &QCheckBox::toggled, this,
          [this](bool checked) {
            AppState::instance()->setShuffleBeforePlayingAll(checked);
          });
  connect(m_targetNormalizationSlider, &QSlider::valueChanged, this,
          [this](int value) {
            m_targetNormalizationValue->setText(sliderValueText(value, 1));
            AppState::instance()->setTargetNormalizationDbs(value / 10.0);
          });
  connect(m_maxNormalizationSlider, &QSlider::valueChanged, this,
          [this](int value) {
            m_maxNormalizationValue->setText(sliderValueText(value, 1));
            AppState::instance()->setMaxNormalizationDbs(value / 10.0);
          });
  connect(m_searchHistoryLimitSpin, &QSpinBox::valueChanged, this,
          [this](int value) {
            AppState::instance()->setSearchHistoryLimit(value);
          });
  connect(m_saveButton, &QPushButton::clicked, this,
          &SettingsWidget::onSaveClicked);
  connect(m_darkModeCheck, &QCheckBox::toggled, this,
          [this](bool checked) { AppState::instance()->setDarkMode(checked); });
  connect(m_rescanButton, &QPushButton::clicked, this,
          [this]() { onRescanClicked(false); });
  connect(m_forceRescanButton, &QPushButton::clicked, this,
          [this]() { onRescanClicked(true); });

  // Server properties
  QWidget *propsBody = nullptr;
  QGroupBox *propsSection = makeSection(tr("Server Properties"), &propsBody);
  layout->addWidget(propsSection);

  auto *form = new QWidget();
  auto *formLayout = new QFormLayout();
  formLayout->setContentsMargins(0, 0, 0, 0);
  form->setLayout(formLayout);
  propsBody->layout()->addWidget(form);

  m_versionEdit = new QLineEdit();
  m_httpBindEdit = new QLineEdit();
  m_ipcEnabledEdit = new QLineEdit();
  m_ipcPathEdit = new QLineEdit();
  m_dataPathEdit = new QLineEdit();
  m_dbDirEdit = new QLineEdit();
  m_cacheDbEnabledEdit = new QLineEdit();
  m_coverCacheMaxBytesEdit = new QLineEdit();
  m_mediaDownloaderEdit = new QLineEdit();

  const QList<QLineEdit *> readOnlyEdits = {
      m_versionEdit,        m_httpBindEdit,           m_ipcEnabledEdit,
      m_ipcPathEdit,        m_dataPathEdit,           m_dbDirEdit,
      m_cacheDbEnabledEdit, m_coverCacheMaxBytesEdit, m_mediaDownloaderEdit,
  };
  for (QLineEdit *edit : readOnlyEdits) {
    edit->setReadOnly(true);
  }

  formLayout->addRow(tr("Version:"), m_versionEdit);
  formLayout->addRow(tr("HTTP Bind:"), m_httpBindEdit);
  formLayout->addRow(tr("IPC Enabled:"), m_ipcEnabledEdit);
  formLayout->addRow(tr("IPC Socket Path:"), m_ipcPathEdit);
  formLayout->addRow(tr("Data Path:"), m_dataPathEdit);
  formLayout->addRow(tr("Database Directory:"), m_dbDirEdit);
  formLayout->addRow(tr("Cache database enabled:"), m_cacheDbEnabledEdit);
  formLayout->addRow(tr("Cover cache max bytes:"), m_coverCacheMaxBytesEdit);
  formLayout->addRow(tr("Media Downloader:"), m_mediaDownloaderEdit);

  // Ongoing processes
  QWidget *processBody = nullptr;
  QGroupBox *processSection =
      makeSection(tr("Ongoing Processes"), &processBody);
  layout->addWidget(processSection);
  m_progressWidget = new ProgressWidget(processBody);
  processBody->layout()->addWidget(m_progressWidget);

  layout->addStretch();
  scroll->setWidget(content);
  outer->addWidget(scroll);
}

QGroupBox *SettingsWidget::makeSection(const QString &title,
                                       QWidget **bodyOut) {
  auto *group = new QGroupBox(title);

  auto *body = new QWidget(group);
  auto *bodyLayout = new QVBoxLayout(body);
  bodyLayout->setContentsMargins(0, 0, 0, 0);
  bodyLayout->setSpacing(6);

  auto *groupLayout = new QVBoxLayout(group);
  groupLayout->addWidget(body);

  *bodyOut = body;
  return group;
}

QWidget *SettingsWidget::makeSliderRow(const QString &label, int min, int max,
                                       QSlider **sliderOut, QLabel **valueOut) {
  auto *row = new QWidget();
  auto *rowLayout = new QVBoxLayout(row);
  rowLayout->setContentsMargins(0, 0, 0, 0);

  auto *header = new QHBoxLayout();
  header->addWidget(new QLabel(label));
  header->addStretch();
  auto *value = new QLabel();
  header->addWidget(value);
  rowLayout->addLayout(header);

  auto *slider = new QSlider(Qt::Horizontal);
  slider->setRange(min, max);
  slider->setSingleStep(1);
  slider->setPageStep(qMax(1, (max - min) / 10));
  rowLayout->addWidget(slider);

  *sliderOut = slider;
  *valueOut = value;
  return row;
}

void SettingsWidget::updateFromState() {
  AppState *state = AppState::instance();

  m_amplificationSlider->setValue(qRound(state->amplification() * 10.0));
  m_amplificationValue->setText(
      sliderValueText(m_amplificationSlider->value(), 1));
  m_normalizeCheck->setChecked(state->normalize());

  m_shuffleBeforePlayingAllCheck->setChecked(state->shuffleBeforePlayingAll());

  m_targetNormalizationSlider->setValue(
      qRound(state->targetNormalizationDbs() * 10.0));
  m_targetNormalizationValue->setText(
      sliderValueText(m_targetNormalizationSlider->value(), 1));
  m_maxNormalizationSlider->setValue(
      qRound(state->maxNormalizationDbs() * 10.0));
  m_maxNormalizationValue->setText(
      sliderValueText(m_maxNormalizationSlider->value(), 1));

  m_searchHistoryLimitSpin->setValue(state->searchHistoryLimit());
  m_darkModeCheck->setChecked(state->darkMode());
}

void SettingsWidget::updateServerProps(const QJsonObject &props) {
  const QString version = props["version"].toString();
  const QJsonObject config = props["config"].toObject();

  m_versionEdit->setText(version);
  m_httpBindEdit->setText(config["http_bind"].toString());
  m_ipcEnabledEdit->setText(config["ipc_bind_enabled"].toBool() ? tr("true")
                                                                : tr("false"));
  m_ipcPathEdit->setText(config["ipc_bind"].toString());
  m_dataPathEdit->setText(config["data_path"].toString());
  m_dbDirEdit->setText(config["db_dir"].toString());
  m_cacheDbEnabledEdit->setText(
      config["cache_db_enabled"].toBool() ? tr("true") : tr("false"));
  m_coverCacheMaxBytesEdit->setText(
      QString::number(config["cover_cache_max_bytes"].toInt()));
  m_mediaDownloaderEdit->setText(config["media_downloader"].toString());
}

void SettingsWidget::onSaveClicked() {
  AppState::instance()->saveConfig();
  emit statusMessage(tr("Settings saved"));
}

void SettingsWidget::onRescanClicked(bool force) {
  if (m_scanWatcher->isRunning()) {
    emit statusMessage(tr("Scan already running"));
    return;
  }
  emit statusMessage(force ? tr("Forced rescan started")
                           : tr("Rescan started"));
  m_scanWatcher->setFuture(m_api->scanTracks(QString(), force));
}

void SettingsWidget::onRescanFinished() {
  emit statusMessage(tr("Rescan complete"));
  emit rescanCompleted();
}
