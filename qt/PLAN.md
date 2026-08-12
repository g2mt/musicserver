# Qt Frontend Conversion Plan

## Overview

Convert the existing React/TypeScript frontend (`frontend/src/`) to a native Qt6/C++
desktop application under `qt/`. The Qt app links against `libmusicserver.a` (a C API
exported from the Go backend) via the existing `CMakeLists.txt`. This eliminates the
HTTP round-trip for API calls and enables native OS integration.

## Architecture: Application Shell

The Qt application replaces the browser DOM with a single `QMainWindow`. It uses a
`QToolBar` for the search bar and a central widget with a vertical split layout:

```
┌─────────────────────────────────────┐
│ ▼ QToolBar (search bar)             │  ← movable native toolbar
├──────────────┬──────────────────────┤
│ Left Panel   │ Right Panel (queue)  │  ← QSplitter, stretches
│ (tabs)       │                      │
├──────────────┴──────────────────────┤
│ MusicPlayer          (playback)     │  ← fixed height (~100px)
└─────────────────────────────────────┘
```

- **Window title**: set dynamically to `currentTrack.name` or `"Music Server"`.
- **Dark/light mode**: toggle via a custom stylesheet that mirrors the CSS custom
  properties from `common.css`. Persist preference in `QSettings`.
- **Keyboard shortcuts**: space/k for play/pause, j/l for seek, m for mute, etc.
  (mirroring `App.tsx` keyboard handler). Use `QShortcut` on the main window.
- **Config persistence**: `QSettings` replacing the current `Settings` abstraction.
- **Responsive**: at narrow widths (<800px), change the `QSplitter` orientation from
  `Horizontal` to `Vertical` (monitor via `resizeEvent`).

## Core State (replacing React context)

Create an **`AppState` singleton** (or passed via dependency injection) holding:

| Field | Type | Source |
|---|---|---|
| `currentTrack` | `TrackData*` | Audio engine |
| `isPlaying` | `bool` | Audio engine |
| `progress` / `duration` | `double` (seconds) | Audio engine |
| `volume` / `muted` | `double` / `bool` | User slider/button |
| `searchQuery` | `QString` | Search bar |
| `resultSort` / `resultDesc` | `QString` / `bool` | Sort controls |
| `resultLimit` | `int` | Limit selector |
| `queueTracks` | `QList<TrackData>` | Track queue model |
| `queueIndex` | `int` (-1 if none) | Track queue model |
| `repeat` | enum: None/Track/Queue | Repeat mode |
| `darkMode` | `bool` | Setting |
| `showBlurredCover` | `bool` | Setting |
| `leftTab` | enum: Tracks/Bookmarks/Files/Settings | Tab bar |
| `fbPath` | `QStringList` | File browser |
| `bookmarks` | `QList<Bookmark>` | Bookmarks |
| other settings | various | Settings tab |

Signals should be emitted on state changes (e.g., `trackChanged`, `searchQueryChanged`,
`volumeChanged`) so that UI widgets can reactively update.

## Backend Communication

The `libmusicserver` library already abstracts HTTP away — there is no HTTP, REST,
or SSE involved. All communication goes through the C API declared in
`libmusicserver.h`:

| Previous frontend call | Qt replacement |
|---|---|
| `fetchAPI("/track", {q, limit})` | `MsrvHandleRequest(iface, "/track", "GET", paramsJson)` → `MsrvReadAll` |
| `fetchAPI("/track/:id", ..., "DELETE")` | `MsrvHandleRequest(iface, "/track/:id", "DELETE", "{}")` |
| `fetchAPI("/props")` | `MsrvHandleRequest(iface, "/props", "GET", "{}")` |
| `fetchAPI("/progress")` | `MsrvHandleRequest(iface, "/progress", "GET", "{}")` — poll via `QTimer` |
| `fetchAPI("/track/:external/...")` | `MsrvHandleRequest(iface, ...)` |
| `rescanFiles(false, path)` | `MsrvHandleRequest(iface, "/track", "POST", {path, force})` |
| `Settings.getItem/setItem` | `QSettings` |

**Implementation**: Create an `ApiClient` class wrapping `MsrvHandleRequest`. Since
`libmusicserver` calls are synchronous, run them on a `QThread` or use
`QtConcurrent::run` to avoid blocking the GUI thread. Return results via
`QFuture`/signals.

For the progress table (replacing the old `listenAPI("/progress/:events")` SSE stream),
poll `/progress` on a `QTimer` (e.g. every 500ms).

**JSON parsing**: Use `QJsonDocument` / `QJsonObject` / `QJsonArray` from Qt.
Define `TrackData` as a `struct` with a `static TrackData fromJson(const QJsonObject&)`
factory.

## Audio Playback

The React frontend had three audio backends: `BrowserAudio` (web Audio API),
`NativeAudio` (Android JNI), and `apiAudio` (selects between them). The Qt desktop
app needs a **Qt audio backend** using `QMediaPlayer` (Qt6 Multimedia module):

```cpp
class QtAudioPlayer : public QObject {
  Q_OBJECT
  QMediaPlayer* player;
  QAudioOutput* audioOutput;
public:
  void setSource(const QString& url);
  void play();
  void pause();
  void setVolume(float v);       // 0.0–1.0
  void setAmplification(float dB); // via QAudioOutput or software gain
  qint64 currentTime() const;
  qint64 duration() const;
signals:
  void timeChanged(qint64 ms);
  void ended();
  void durationChanged(qint64 ms);
};
```

The audio source URL is computed from `TrackData`: either a `file://` URL (for local
files) or use the backend to serve track data.

For the **amplification/normalization** feature, use `loudness` from the backend
API (`/track/:id/loudness`) to compute gain, then apply via `QAudioOutput::setVolume`
multiplied by the gain factor.

**Note**: The existing `CMakeLists.txt` links `Qt6::Widgets`. For audio, add
`Qt6::Multimedia` to `find_package` and `target_link_libraries`.

## UI Component Mapping

### 1. Search Bar (`SearchBar.tsx`)

Use a native **`QToolBar`** added to the `QMainWindow`. It contains:

- A **`QLineEdit`** with placeholder text "Search tracks..." and clear button enabled
- **`QAction`** objects for: Home (scroll to top), Search (submit), Download
  (if media_downloader configured), styled with icons
- Pressing Enter in the line edit submits the search

### 2. Search Suggestions (`SearchSuggestions.tsx`)

- Use a custom popup widget positioned below the search `QLineEdit`, filtered as the
  user types, with keyboard navigation (arrow keys + enter). Backed by `QSettings`
  search history. Or use a `QCompleter` attached to the line edit.

### 3. Tab Bar (`App.tsx` tab buttons)

- Use **`QTabBar`** (standalone, not `QTabWidget`) with four tabs: Tracks, Bookmarks,
  Files, Settings
- A separator/spacer then a collapse/expand button
- The active tab index controls which widget is shown in the left panel via
  **`QStackedWidget`**

### 4. Track List (`TrackList.tsx` + `Track.tsx`)

- **`QListView`** with a custom `QAbstractListModel` (`TrackListModel`)
- Each row: cover art thumbnail (56px), track name, album, artist (as clickable links)
- Virtual scrolling: use `canFetchMore`/`fetchMore` in the model for pagination
- Right-click: **`QMenu`** context menu with Play, Copy info, Go to Album/Artist/Path,
  Forget track
- Highlight the currently playing track with a background color
- Track rows have +/- buttons for enqueue/unqueue (via a custom delegate)

### 5. Music Player (`MusicPlayer.tsx`)

- **Scrubber bar**: `QSlider` (horizontal, range 0–duration)
- **Player controls**: `QPushButton` for Previous, Play/Pause, Next
- **Volume**: `QSlider` + mute button
- **Repeat**: `QPushButton` with badge text (Track/Queue) cycling through
  None → Track → Queue → None
- **Current track info**: cover thumbnail + track name (centered)
- Right-click context menu: Play, Forward, Backward, Repeat options

### 6. File Browser Tab (`FileBrowserTab.tsx`)

- **`QTreeView`** with a custom `QAbstractItemModel` or simple **`QTableWidget`**
- Breadcrumb location bar at top showing `root / path / to / dir`
- Directories listed above files, each clickable
- ".." entry to go up one level
- Icons for search (show tracks in path) and scan (rescan only this path)

### 7. Bookmarks Tab (`BookmarksTab.tsx`)

- **`QListWidget`** with bookmark items
- Add form: `QLineEdit` for name + "Add" `QPushButton`
- Each bookmark row: name + query text, delete button
- Right-click: Rename, Delete
- Click navigates to tracks tab with the bookmark's query

### 8. Settings Tab (`SettingsTab.tsx`)

- Use **`QScrollArea`** containing sections (each a `QGroupBox`)
- Sections are collapsible via `QGroupBox::setCheckable(true)`
- Playback section: amplification slider, normalize checkbox
- General section: checkboxes for showBlurredCover, showOnlyQueueAfterEnqueue,
  shuffleBeforePlayingAll, showTracksListOnTabChange; sliders for normalization dB;
  search history limit spin box; Save button; Dark/Light mode toggle; Rescan buttons
- Server properties section: read-only form showing version, config values from
  `/props`
- Ongoing processes section: `QTableWidget` with progress bars, polled via `QTimer`

### 9. Context Menu (`ContextMenu.tsx`)

- Use native **`QMenu`** — no custom implementation needed
- Where the React version toggles a floating div at absolute coordinates, just call
  `QMenu::exec()` or `QMenu::popup()`

### 10. Confirm Box (`ConfirmBox.tsx`)

- Use **`QMessageBox::question()`** for simple yes/no dialogs
- For the download confirmation with collapsible track list, create a custom
  **`QDialog`**

### 11. Toast Notifications (`toast.tsx`)

- Use `QStatusBar::showMessage()` on the main window's status bar for transient
  messages, or a custom notification widget that auto-hides

### 12. Select Dropdown (`Select.tsx`)

- Use native **`QComboBox`**

### 13. Progress Table (`ProgressTable.tsx`)

- Use **`QTableWidget`** with columns: Name, Progress (`QProgressBar`), Output
- Poll `/progress` on a `QTimer` (e.g. every 500ms) since the library abstracts HTTP
  and there are no SSE streams

## Collapsed/Responsive Layout

When window width < 800px:
- Change the `QSplitter` orientation from `Horizontal` to `Vertical`
- Left and right panels stack vertically instead of side by side

## Dark Mode

- Persist preference in `QSettings`. For now, do not implement dark mode and just print to stderr.

## Data Flow

```
User Action → Widget Signal → AppState method → ApiClient → MsrvHandleRequest
                                                    ↓
                                              JSON result
                                                    ↓
UI Update ← AppState signal ← AppState updates model ← parsed data
```

## File Structure (proposed)

```
qt/
├── CMakeLists.txt
├── src/
│   ├── main.cpp
│   ├── AppMainWindow.h / .cpp          # QMainWindow subclass (toolbar + layout)
│   ├── AppState.h / .cpp               # Central state + signals
│   ├── ApiClient.h / .cpp              # libmusicserver wrapper
│   ├── TrackData.h                     # struct + JSON parsing
│   ├── TrackListModel.h / .cpp         # QAbstractListModel for track list
│   ├── FileListModel.h / .cpp          # QAbstractItemModel for file browser
│   ├── Bookmark.h                      # struct
│   ├── QtAudioPlayer.h / .cpp          # QMediaPlayer wrapper
│   ├── SearchSuggestions.h / .cpp      # completer / popup
│   ├── TrackDelegate.h / .cpp          # custom paint for track rows
│   ├── MusicPlayer.h / .cpp            # playback controls bar
│   ├── FileBrowserWidget.h / .cpp      # tree/table browser
│   ├── BookmarksWidget.h / .cpp        # bookmark list
│   ├── SettingsWidget.h / .cpp         # settings panel
│   ├── ProgressWidget.h / .cpp         # progress table
│   └── ToastManager.h / .cpp           # notification overlay
└── PLAN.md                             # this file
```

All source files live flat under `qt/src/` to keep the structure simple.

## Dependencies to Add to CMakeLists.txt

- `Qt6::Multimedia` — for `QMediaPlayer` / `QAudioOutput`

## Implementation Order

1. **Phase 1 — Skeleton**: `AppMainWindow` with toolbar + `QSplitter` layout,
   `AppState` singleton with signals, `ApiClient` wrapping `MsrvHandleRequest`,
   `TrackData` struct + JSON parse.

2. **Phase 2 — Audio**: `QtAudioPlayer` with play/pause/seek/volume, wired to
   `AppState`.

3. **Phase 3 — Core UI**: Search toolbar + Track list (with model) + Music player.
   End-to-end: search → display tracks → play a track.

4. **Phase 4 — Queue**: Enqueue, dequeue, next/prev navigation, repeat modes,
   shuffle. Right panel track list.

5. **Phase 5 — Remaining tabs**: File browser, Bookmarks, Settings.

6. **Phase 6 — Polish**: Dark mode, config persistence, keyboard shortcuts,
   context menus, toast notifications, confirm dialogs, progress table,
   collapsed/responsive layout.
