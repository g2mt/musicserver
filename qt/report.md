# Qt port feature gap report

## Scope and method

This report compares the user-facing behavior implemented under `frontend/src/` with the Qt port under `qt/src/`. It focuses on features that are present in the frontend but have no corresponding Qt implementation or are materially incomplete in Qt. Existing Qt equivalents are not listed as gaps merely because their widgets or APIs differ.

The most important gaps are summarized below:

| Priority | Missing or incomplete feature | Frontend evidence | Qt evidence |
| --- | --- | --- | --- |
| High | Dark mode and blurred album-cover background | `App.tsx`, `SettingsTab.tsx`, `App.css` | No dark-mode/background state or rendering in `AppState`/`AppMainWindow` |
| High | Queue/audio state restoration | `TrackQueue.tsx`, `AudioState.tsx`, `App.tsx` | No queue/audio serialization or suspend restoration in Qt |
| High | URL/media downloading workflow | `SearchBar.tsx`, `/track/:external/...` | No external-track lookup, confirmation, or download action |
| High | Loudness-based normalization | `audio/AudioState.tsx` | Qt has a normalize checkbox but never computes loudness or applies normalization |
| Medium | Track-list actions and error feedback parity | `Track.tsx` | Qt forgets silently and does not provide equivalent toast/error handling |

## 1. Dark mode and blurred-cover background — high priority

### Frontend behavior

The frontend stores `darkMode` and `showBlurredCover` in `AppStateSchema`, exposes both through the Settings tab, applies a `dark-mode` class to `body`, and renders a blurred, darkened version of the current track's cover into the `#background-overlay` canvas. The background is updated when the current track or dark-mode state changes. The setting can be disabled independently.

Relevant files:

- `frontend/src/App.tsx`: `darkMode`, `showBlurredCover`, body class update, canvas rendering.
- `frontend/src/SettingsTab.tsx`: Light/Dark Mode button and blurred-cover checkbox.
- `frontend/src/AppState.tsx`: persisted configuration fields.
- `frontend/src/App.css` and `frontend/src/common.css`: dark-mode presentation.

### Qt gap

`AppState` has no `darkMode`, `showBlurredCover`, or related signals. `AppMainWindow` does not set a palette/style for dark mode and has no background image/canvas equivalent. `SettingsWidget` does not expose either option, and `loadConfig()`/`saveConfig()` do not persist them.

### Suggested implementation

Add persisted dark-mode and blurred-cover state to `AppState`, add controls to `SettingsWidget`, and apply a window/application palette or stylesheet. A background widget behind the main splitter can display a scaled, blurred cover loaded from the current track. It should be disabled unless both settings are enabled and the current track has cover art.

## 2. Queue and audio restoration — high priority

### Frontend behavior

The frontend has explicit serialization hooks for both queue and audio state. The native bridge can save the queue (`paths`, index, repeat), restore audio state after suspend, reload a track through `/track/:by-path`, restore playback position and playing state, and request queue restoration through native integration.

Relevant files:

- `frontend/src/TrackQueue.tsx`: `SerializedTrackQueue`, native queue-save request, `loadSerializedState`.
- `frontend/src/audio/AudioState.tsx`: `SerializedAudioState` and `loadSerializedState`.
- `frontend/src/App.tsx`: `_reloadFromSuspend`, native bridge restoration.
- `frontend/src/audio/NativeAudio.tsx`: native audio message-port integration.

### Qt gap

Qt only saves ordinary settings and bookmarks. `AppState::saveConfig()` does not save queue tracks, queue index, repeat mode, current track, playback position, or playing state. There is no startup restoration, suspend callback, native bridge, or equivalent serialization format. The `MusicPlayer` comment in `AppMainWindow.h` also describes the player as a placeholder, although its basic controls are implemented.

### Suggested implementation

Persist queue paths, queue index, repeat mode, current track path, current position, and playing state in `QSettings` or a versioned JSON object. Restore tracks through `ApiClient::loadTrackByPath()` before starting playback. If the Qt application has a suspend/resume integration, expose the same restoration operation there; otherwise restore on application startup and save on shutdown.

## 3. External URL/media download — high priority

### Frontend behavior

When the server advertises a configured media downloader, the search bar displays a download button. For an `http://` or `https://` URL it requests track metadata from `/track/:external/<encoded URL>`, opens a confirmation box showing the candidate tracks, and then POSTs to the same endpoint. It reports started, completed, and failed states through toast notifications.

Relevant file: `frontend/src/SearchBar.tsx`.

### Qt gap

`AppMainWindow::setupToolbar()` only creates home, search, and text-entry controls. It does not inspect `serverProps().config.media_downloader`, validate URLs, request external track data, display a confirmation dialog, or POST a download request. Qt's `ApiClient` has generic GET/POST methods, but no feature-level implementation.

### Suggested implementation

Add a download action beside the search field when `media_downloader` is non-empty. Use a Qt confirmation dialog listing returned tracks, then call `ApiClient::post()` and report all outcomes in the status bar or a dedicated notification mechanism.

## 4. Loudness-based normalization — high priority

### Frontend behavior

The frontend's Normalize setting is functional: when normalization is enabled it obtains loudness either from the native audio implementation or `/track/<id>/loudness`, then computes amplification as `min(targetNormalizationDbs - loudness, maxNormalizationDbs)`. It reacts to track changes and target-normalization changes and reports failures.

Relevant file: `frontend/src/audio/AudioState.tsx`.

### Qt gap

Qt exposes `normalize`, `targetNormalizationDbs`, and `maxNormalizationDbs`, but `AppMainWindow::setupAudio()` only connects `amplificationChanged` to `NativeAudioPlayer::setAmplification()`. There is no request to `/track/<id>/loudness`, no loudness calculation, and no automatic amplification update when normalization is enabled or settings change. The Qt checkbox therefore changes state without changing playback gain.

### Suggested implementation

On current-track, normalize, and target/max setting changes, request `/track/<id>/loudness`. Calculate the same bounded gain as the frontend and set the effective amplification on `NativeAudioPlayer`. Preserve manually selected amplification when normalization is disabled. Guard against stale asynchronous responses when the track changes.

## 5. Search result limit and pagination controls — medium priority

### Frontend behavior

The frontend exposes a result-limit selector with 50, 100, 150, and unlimited options. It also provides `before:<short_id>` and `after:<short_id>` controls for navigating result pages. The selected query and limit are reflected in the URL hash and the result metadata updates the controls.

Relevant files:

- `frontend/src/MainTracksTab.tsx`: limit selector and previous/next controls.
- `frontend/src/App.tsx`: query limit and hash synchronization.
- `frontend/src/TrackData.tsx`: result/filter metadata.

### Qt gap

`AppMainWindow::refreshSearch()` always sends `limit="-1"`. There is no limit selector, no URL/hash equivalent, and no before/after navigation buttons. Qt receives `resultLimit` from the server but only stores it; it does not provide a way to change it. Qt's sort menu covers only sort selection, not the rest of the result navigation controls.

### Suggested implementation

Add a limit selector to the tracks toolbar and send the selected limit with `/track`. Add previous/forward actions that use the first and last visible track short IDs. Keep the query and limit synchronized with the existing `AppState` search fields.

## 6. “Show only queue after enqueue” and “show tracks list on tab change” — medium priority

### Frontend behavior

The frontend has two distinct layout preferences:

- `showOnlyQueueAfterEnqueue`: after adding visible/all tracks or starting Play All, collapse the tracks list and reveal the queue.
- `showTracksListOnTabChange`: automatically expand the tracks list when switching left-side tabs.

Both are configurable and persisted.

Relevant files: `frontend/src/App.tsx`, `frontend/src/MainTracksTab.tsx`, `frontend/src/SettingsTab.tsx`, and `frontend/src/AppState.tsx`.

### Qt gap

Qt's `AppState` only contains `tracksListCollapsed` and `queueCollapsed`. It has no equivalent preference, no settings controls, and no behavior in `addVisibleTracks()`, `fetchAllTracks()`, or `onTabClicked()`. Consequently, adding tracks never changes the panel visibility based on user preference, and changing tabs does not automatically expand the tracks list.

### Suggested implementation

Add both booleans, signals, settings persistence, and controls to `SettingsWidget`. Apply them when queue additions or Play All complete and when `setLeftTab()` changes.

## 7. Search suggestions/history behavior — medium priority

### Frontend behavior

`SearchSuggestions` provides a custom popup, case-insensitive filtering, arrow-key selection, Enter-to-select, a history icon, and a per-suggestion remove button. Suggestions are stored as objects with `q` and `lastUsed`, trimmed to the configured history limit, and can be removed individually.

Relevant file: `frontend/src/SearchSuggestions.tsx`.

### Qt gap and incompatibility

Qt uses `QCompleter` in `AppMainWindow::setupToolbar()` with a `QStringListModel` loaded from `QSettings`. It supports basic completion activation and substring filtering, but lacks:

- a custom history popup with per-entry delete controls;
- explicit timestamp/last-used data;
- a visible history icon and remove action;
- frontend-compatible JSON history storage;
- equivalent controlled focus/keyboard behavior;
- a clear-history operation.

The two implementations also use different persisted formats: Qt stores a `QStringList` under `searchSuggestions`, while the frontend expects JSON objects. A shared settings location therefore cannot be exchanged between ports.

### Suggested implementation

Either implement a custom Qt completer popup or extend the existing completer with a removable model and actions. Decide on one cross-port storage schema, preferably a JSON array of `{q,lastUsed}` objects, and migrate the current Qt string-list format.

## 8. Touch/swipe previous-next navigation — medium priority

### Frontend behavior

The music player listens for touch start/end on its controls and navigates backward or forward when a horizontal swipe exceeds 50 pixels.

Relevant file: `frontend/src/MusicPlayer.tsx`.

### Qt gap

`MusicPlayer` has no touch event handling, gesture recognizer, or swipe threshold logic. On touch-capable Qt devices, horizontal swipes do not navigate the queue.

### Suggested implementation

Install an event filter or use `QGestureRecognizer`/touch events on the player controls. Track the initial and final horizontal positions, ignore small movements, and call `queuePrev()` or `queueNext()` for the same threshold behavior.

## 9. Track actions and user feedback parity — medium priority

### Frontend behavior

Track context menus include Play, Add/Remove Queue, Copy Info, Album, Artist, Path, and Forget Track. Forget Track uses DELETE, immediately reports success/failure, and removes the row from the visible list. Search and download operations also show explicit toast errors.

Relevant files: `frontend/src/Track.tsx`, `frontend/src/toast.tsx`, `frontend/src/SearchBar.tsx`.

### Qt gap

Qt has most of the track context-menu actions in `TrackListView`, including Forget Track, but the DELETE continuation only emits a search refresh and does not report success or failure. `ApiClient` collapses request errors to an empty document, so callers cannot distinguish a failed request from an empty response reliably. Several Qt request failures are reported only through debug logging or generic status text.

### Suggested implementation

Make `ApiClient` return structured error information (or a result type) and show success/failure feedback for Forget Track, search, file loading, and rescans. After a successful delete, refresh the list and confirm which track was forgotten.

## 10. Media integration and playback behavior — low/medium priority

### Frontend behavior

The browser frontend configures the Media Session API with title, artist, album, artwork, and play/pause/previous/next handlers. Native frontend builds expose message-port hooks for audio state and suspend handling.

Relevant files: `frontend/src/MusicPlayer.tsx`, `frontend/src/audio/NativeAudio.tsx`, `frontend/src/audio/apiAudio.tsx`.

### Qt status

Qt has an optional MPRIS implementation in `Mpris.cpp`, which covers much of the desktop media-control use case. However, it is not equivalent on platforms where MPRIS is unavailable, and there is no Qt equivalent of the frontend's native bridge/state hooks. This is a parity consideration rather than a complete absence on Linux desktop.

## 11. Features that are already substantially covered by Qt

The following frontend features have corresponding Qt implementations and should not be treated as missing features:

- Tracks, bookmarks, files, settings, and queue panels (`AppMainWindow.cpp`).
- Play/pause, previous/next, seek, volume, mute, repeat track/queue/off (`MusicPlayer.cpp`).
- Track covers, track highlighting, enqueue/unqueue, play, copy info, album/artist/path actions (`TrackListView.cpp`, `TrackDelegate.cpp`).
- Queue removal, remove all, shuffle, and Play All/Add All (`AppState.cpp`, `TrackListView.cpp`, `AppMainWindow.cpp`).
- Bookmark add, rename, delete, and opening a bookmark (`BookmarksWidget.cpp`).
- File navigation, play-by-path, path scanning, and show-tracks-in-path (`FileBrowserWidget.cpp`).
- Server property display and ongoing process progress (`SettingsWidget.cpp`, `ProgressWidget.cpp`).
- Search history through a basic Qt completer (`AppMainWindow.cpp`).
- Desktop media controls through optional MPRIS (`Mpris.cpp`).

## Recommended implementation order

1. Implement loudness normalization, because the existing Qt setting currently has no playback effect.
2. Add dark mode and the blurred-cover setting/background.
3. Add queue/audio persistence and restoration.
4. Add external URL download confirmation and execution.
5. Add result limits and before/after pagination.
6. Add the two queue/layout preferences.
7. Improve search suggestions and normalize persisted history format.
8. Add touch navigation and improve request/error feedback.

Awaiting compilation.
