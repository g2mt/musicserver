#pragma once

#include <functional>
#include <QStringList>

class QMenu;
class QObject;
struct TrackData;

void addTrackNavigationActions(QMenu &menu, QObject *receiver,
                               const TrackData &track,
                               std::function<void(const QStringList &)> onPath);
