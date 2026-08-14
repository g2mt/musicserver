#include "TrackNavigationMenu.h"

#include "AppState.h"
#include "TrackData.h"

#include <QIcon>
#include <QMenu>

void addTrackNavigationActions(QMenu &menu, QObject *receiver,
                               const TrackData &track,
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
}
