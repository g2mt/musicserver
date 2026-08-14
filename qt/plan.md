# Redundancy audit

Review covering all files in `qt/src/`. Each entry lists the issue, affected locations, and whether it is dead/reachable code.

---

## Redundant model roles in `TrackListModel`

The following custom roles are never read by `TrackDelegate`, `TrackListView`, or any other consumer in `qt/src`:

- `ShortIdRole`
- `ThumbnailPathRole`

They are set up in `data()`, `roleNames()`, and the enum. `Qt::DisplayRole` is also not consumed by the delegate, though it is conventional to keep it.

- `TrackListModel.h:15, 20`
- `TrackListModel.cpp:19, 29, 156, 161`

---

## Dead search-limit state in `AppState`

`resultLimit`, `setResultLimit()`, and the `resultLimitChanged` signal are wired up but:

- `refreshSearch()` always sends `"limit": -1` (unlimited).
- `resultLimit()` is never called by any widget.
- `resultLimitChanged` has zero connections.

`setSearchQuery()` also overwrites `m_resultLimit`, but only emits `searchQueryChanged`, so the limit state is stored without observable effect.

- `AppState.h:36, 81, 135`
- `AppState.cpp:103, 107–126, 437`
- `AppMainWindow.cpp:707`

---

## Repeated on-update logic

### 6. Download-action visibility duplicated

The same URL check and `m_downloadAction` hide/show/enable logic appears in both `onPropsResultFinished()` and the `m_searchInput::textChanged` handler.

- `AppMainWindow.cpp:97–103` (textChanged)
- `AppMainWindow.cpp:643–649` (onPropsResultFinished)

### 7. Duplicate “Go to” menu building

`MusicPlayer::contextMenuEvent()` and `TrackListView::setupUi()` each construct Album / Artist / Path navigation actions with near-identical structure. The path-action logic diverges slightly (one emits a signal, the other manipulates `AppState` directly), but could be consolidated.

- `MusicPlayer.cpp:344–368`
- `TrackListView.cpp:130–148`

### 8. Repeated search-history navigation

`navigateSearchHistory()` and the per-item handler in `showSearchHistoryMenu()` perform the same sequence: set `m_searchHistoryIndex`, retrieve the query, call `setSearchQuery(query, 0, true)`, update actions.

- `AppMainWindow.cpp:588–595, 603–622`

### 9. Duplicate volume/mute → player reflection

Both the `volumeChanged` and `mutedChanged` connections in `setupAudio()` run the same lambda. Should be extracted into `updateAudioVolume()`.

- `AppMainWindow.cpp:200–218`

### 10. `QTreeWidget` cleared twice

`FileBrowserWidget::refresh()` calls `m_tree->clear()`, then `onListingFinished()` also calls `m_tree->clear()` at its start before rebuilding.

- `FileBrowserWidget.cpp:195, 228`

### 11. Stale cover clearance

`MusicPlayer::updateTrackFromState()` calls `m_trackCover->clear()` immediately before overwriting the same label with the fallback pixmap. The clear is not visible.

- `MusicPlayer.cpp:262–263`

### 12. `queueAdd()` redundantly creates a single-element list

```cpp
void AppState::queueAdd(const TrackData &track) {
  const int startIndex = m_queueTracks.size();
  m_queueTracks.append(track);
  QList<TrackData> added;
  added.append(track);
  emit queueTracksAdded(added, startIndex);
}
```

This duplicates `queueAddAll({track})` except for the explicit `QList` construction. Could delegate.

- `AppState.cpp:168–174`

---

## Summary by file

| File | Issues |
|------|--------|
| `AppMainWindow` | Dead timer, redundant search-limit write, duplicate visibility and navigation logic |
| `MusicPlayer` | Dead slot, no-op slot, duplicate cover & menu code |
| `NativeAudioPlayer` | Dead signal, dead accessors |
| `TrackListModel` | Unused model roles |
| `AppState` | Dead search-limit state, can `queueAdd` vs `queueAddAll` |
| `FileBrowserWidget` | Double tree-cleear |
| `SettingsWidget` | (noted separately: helper extraction opportunites) |
| `TrackListView`| Duplicate go-to menu |

See the filed You of the review conversation for expanded analysis of each point.