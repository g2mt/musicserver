#include "TrackNavigationMenu.h"

#include "AppState.h"
#include "TrackData.h"

#include <QIcon>
#include <QMenu>
#include <QProcess>

#include <filesystem>
namespace fs = std::filesystem;

static void openParentDirInFileBrowser(const TrackData &track) {
  QString musicDir = AppState::instance()->serverProps()["config"].toObject()["data_path"].toString();
  fs::path parentDir = fs::path(track.path.toStdString()).parent_path();
  QString fullPath = QString::fromStdString((fs::path(musicDir.toStdString()) / parentDir).string());
#if defined(Q_OS_LINUX)
  QProcess::startDetached("xdg-open", {fullPath});
#elif defined(Q_OS_MACOS)
  QProcess::startDetached("open", {fullPath});
#elif defined(Q_OS_WIN)
  QProcess::startDetached("explorer", {fullPath});
#endif
}

void addTrackNavigationActions(
    QMenu &menu, QObject *receiver, const TrackData &track,
    std::function<void(const QStringList &)> onPath) {
  QMenu *goToMenu = menu.addMenu("Go to...");
  if (!track.album.isEmpty()) {
    goToMenu->addAction(QIcon::fromTheme("media-optical"), "Album", receiver,
                        [track]() {
                          AppState::instance()->setSearchQuery(
                              QString("album:\"%1\"").arg(track.album));
                        });
  }
  if (!track.artist.isEmpty()) {
    goToMenu->addAction(QIcon::fromTheme("user-identity"), "Artist", receiver,
                        [track]() {
                          AppState::instance()->setSearchQuery(
                              QString("artist:\"%1\"").arg(track.artist));
                        });
  }
  goToMenu->addAction(QIcon::fromTheme("folder"), "Path", receiver,
                      [track, onPath]() {
                        QStringList parts = track.path.split("/");
                        parts.removeLast();
                        onPath(parts);
                      });
  goToMenu->addSeparator();
  goToMenu->addAction(QIcon::fromTheme("folder-open"), "Parent Directory in File Browser...", receiver,
                 [track]() { openParentDirInFileBrowser(track); });
}
