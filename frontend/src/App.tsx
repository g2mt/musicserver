import { useTrackList } from "./TrackList";
import { MainTracksTab } from "./MainTracksTab";
import { SettingsTab } from "./SettingsTab";
import FileBrowserTab from "./FileBrowserTab";
import { MusicPlayer } from "./MusicPlayer";
import SearchBar from "./SearchBar";
import React, { useEffect, useRef, useState } from "react";
import { getTrackCover } from "./Track";
import { fetchAPI } from "./apiServer";
import {
  faMusic,
  faGear,
  faFolder,
  faPlus,
  faMinus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { toast, ToastContainer } from "react-toastify";
import { ContextMenu } from "./ContextMenu";
import { AppContext, mergeConfig, saveConfig, type AppState } from "./AppState";
import { useAudio, type SerializedAudioState } from "./AudioState";
import type { TrackData } from "./TrackData";
import { useTrackQueue, type SerializedTrackQueue } from "./TrackQueue";
import { COLLAPSE_AT_WIDTH, useWindowWidth } from "./responsive";
import { SearchSuggestions } from "./SearchSuggestions";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

declare global {
  interface NativeAudioBridge {
    loadAudioState: () => string;
  }
  interface Window {
    _native_audio_bridge?: NativeAudioBridge;
    _reloadFromSuspend?: () => void;

    _refreshSearch?: () => void;
    _setIsPlaying?: (_: boolean) => void;
    _handleBack?: () => void;
    _handleForward?: () => void;
  }
}

export function App() {
  const c = {} as AppState;

  // Prevent flickering by fading the body in
  useEffect(() => {
    document.body.style.opacity = "1";
  }, []);

  // ### States

  // State variables
  [c.volume, c.setVolume] = useState(1);
  [c.muted, c.setMuted] = useState(false);
  [c.darkMode, c.setDarkMode] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  [c.showBlurredCover, c.setShowBlurredCover] = useState(true);
  [c.showOnlyQueueAfterEnqueue, c.setShowOnlyQueueAfterEnqueue] =
    useState(false);
  [c.searchHistoryLimit, c.setSearchHistoryLimit] = useState(50);
  [c.props, c.setProps] = useState<{ version: string; config: any } | null>(
    null,
  );
  [c.fbPath, c.setFbPath] = useState<string[]>([]);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", c.darkMode);
  }, [c.darkMode]);

  // Config

  useEffect(() => {
    fetchAPI("/props")
      .then(c.setProps)
      .catch(() => {});
  }, []);

  // Hash params (parsed like URLSearchParams but from window.location.hash)
  const getHashParams = () =>
    new URLSearchParams(window.location.hash.slice(1));
  const setHashParam = (key: string, value: string) => {
    const params = getHashParams();
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    window.location.hash = params.toString();
  };

  // Search
  const initialHashParams = getHashParams();
  [c.searchQuery, c.setSearchQuery] = useState(
    () => initialHashParams.get("q") ?? "",
  );
  c.oldSearchQuery = useRef(null);
  useEffect(() => {
    function onHashchange() {
      const hashParams = getHashParams();
      c.setSearchQuery(hashParams.get("q") ?? "");
    }

    window.addEventListener("hashchange", onHashchange);
    return () => {
      window.removeEventListener("hashchange", onHashchange);
    };
  });
  c.refreshSearch = () => {
    fetchAPI("/track", { q: c.searchQuery })
      .then((data) => {
        if (data === null || data.length === 0) {
          if (c.oldSearchQuery.current !== null) {
            const oldSearchQuery = c.oldSearchQuery.current;
            c.setSearchQuery(oldSearchQuery);
            c.oldSearchQuery.current = null;
            toast.warn(<>No tracks found</>);
          } else {
            setFullTracks([]);
          }
        } else {
          setFullTracks(data);
          setHashParam("q", c.searchQuery);
          c.oldSearchQuery.current = null;
        }
      })
      .catch((e) => {
        toast.error(<>Error loading: {e.toString()}</>);
        setHashParam("q", c.searchQuery);
      });
  };
  useEffect(() => {
    window._refreshSearch = c.refreshSearch;
    return () => {
      window._refreshSearch = undefined;
    };
  }, []);
  useEffect(c.refreshSearch, [c.searchQuery]);

  // Search input box text
  const [searchInput, setSearchInput] = useState(c.searchQuery);
  useEffect(() => {
    if (c.oldSearchQuery.current !== null) return; // still being processed
    setSearchInput(c.searchQuery);
  }, [c.searchQuery, c.oldSearchQuery.current]);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // Confirm boxes
  const [confirmBoxes, setConfirmBoxes] = useState<
    {
      key: number;
      el: React.ReactNode;
    }[]
  >([]);
  let confirmBoxesCounter = useRef(0);
  c.addConfirmBox = (confirmBox: React.ReactNode) => {
    setConfirmBoxes([
      { key: confirmBoxesCounter.current, el: confirmBox },
      ...confirmBoxes,
    ]);
    confirmBoxesCounter.current += 1;
  };

  // Left/right sides
  [c.leftTab, c.setLeftTab] = useState<"tracks" | "settings" | "files">(
    "tracks",
  );
  const appMain = useRef<HTMLDivElement>(null);
  const appLeftSide = useRef<HTMLDivElement>(null);
  const appRightSide = useRef<HTMLDivElement>(null);
  c.scrollToTop = () => {
    if (appMain.current) {
      appMain.current.scrollTop = 0;
    }
    if (appLeftSide.current) {
      appLeftSide.current.scrollTop = 0;
    }
    if (appRightSide.current) {
      appRightSide.current.scrollTop = 0;
    }
  };

  // Tracks
  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);
  c.onRescanned = () => {
    fetchAPI("/track")
      .then((data) => setFullTracks(data))
      .catch(() => setFullTracks([]));
  };

  // Audio
  c.as = useAudio({
    volume: c.volume,
    muted: c.muted,
  });

  // Track queue
  c.queue = useTrackQueue(c.as);

  useEffect(() => {
    window._reloadFromSuspend = () => {
      console.log("Reloading from suspend");
      if (!window._native_audio_bridge) return;
      const state = JSON.parse(
        window._native_audio_bridge.loadAudioState(),
      ) as {
        audio: SerializedAudioState;
        queue: SerializedTrackQueue;
      };
      c.as.loadSerializedState(state.audio);
      c.queue.loadSerializedState(state.queue);
    };
    return () => {
      window._reloadFromSuspend = undefined;
    };
  }, [c.as, c.queue]);

  useEffect(() => {
    if (c.as.ended) {
      c.queue.next();
      c.as.setEnded(false);
    }
  }, [c.as.ended, c.queue]);

  useEffect(() => {
    if (c.as.playRequestedWithoutTrack) {
      c.queue.next();
      c.as.setPlayRequestedWithoutTrack(false);
    }
  }, [c.as.playRequestedWithoutTrack]);

  // Navigation

  useEffect(() => {
    window._setIsPlaying = c.as.setIsPlaying;
    window._handleBack = c.queue.prev;
    window._handleForward = c.queue.next;
    return () => {
      window._setIsPlaying = undefined;
      window._handleBack = undefined;
      window._handleForward = undefined;
    };
  }, [c.as.currentTrack, c.queue]);

  // ### UI
  // Track queue ui
  const trackQueue = c.queueCollapsed ? null : (
    <TrackList
      tracks={c.queue.tracks}
      canUnqueue={true}
      parentElement={appRightSide}
      queue={c.queue}
    />
  );

  // Collapse state
  [c.tracksListCollapsed, c.setTracksListCollapsed] = useState(false);
  [c.queueCollapsed, c.setQueueCollapsed] = useState(false);

  const windowWidth = useWindowWidth();
  useEffect(() => {
    document.body.classList.toggle(
      "collapsed",
      windowWidth < COLLAPSE_AT_WIDTH,
    );
  }, [windowWidth]);

  // Update body background when current track changes
  const canvasRef = useRef<HTMLCanvasElement>(
    document.getElementById("background-overlay") as HTMLCanvasElement,
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    console.log(canvasRef.current);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (c.as.currentTrack && c.darkMode && c.showBlurredCover) {
      const cover = getTrackCover(c.as.currentTrack);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = cover;
      img.decode().then(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let dx, dw, dh;
        if (canvas.width > canvas.height) {
          dw = canvas.width;
          dh = canvas.width * (img.height / img.width);
          dx = 0;
        } else {
          dh = canvas.height;
          dw = canvas.height * (img.width / img.height);
          dx = -(dw - canvas.width) / 2;
        }

        ctx.filter = "blur(30px) brightness(0.3)";
        ctx.drawImage(img, 0, 0, img.width, img.height, dx, 0, dw, dh);
      });
    }
  }, [c.as.currentTrack, c.darkMode]);

  // ### Post processing and event binding after all states have been configured

  useEffect(() => {
    mergeConfig(c);
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      saveConfig(c);
      if (c.as.isPlaying) {
        e.preventDefault();
        return "A track is playing. Are you sure you want to leave?";
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [c]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.metaKey
      ) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          c.as.setIsPlaying((prev) => !prev);
          break;
        case "m":
          e.preventDefault();
          c.setMuted((prev) => !prev);
          break;
        case "j":
          e.preventDefault();
          c.as.setProgress((prev) => prev - 10);
          break;
        case "l":
          e.preventDefault();
          c.as.setProgress((prev) => prev + 10);
          break;
        case "(":
          e.preventDefault();
          c.setVolume((prev) => Math.max(0, prev - 0.05));
          c.setMuted(false);
          break;
        case ")":
          e.preventDefault();
          c.setVolume((prev) => Math.min(1, prev + 0.05));
          c.setMuted(false);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <AppContext value={c}>
      <ToastContainer
        className="toast-container"
        position="bottom-right"
        theme="dark"
      />
      <ContextMenu />
      <SearchSuggestions
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        searchBarRef={searchBarRef}
      />
      <div id="app-layout">
        <div id="app-top">
          <SearchBar
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            searchBarRef={searchBarRef}
          />
        </div>
        <div id="app-main" ref={appMain}>
          <div id="app-left-side" ref={appLeftSide}>
            <div className="tab-bar">
              <button
                className={`tab-btn ${c.leftTab === "tracks" ? "active" : ""}`}
                onClick={() => c.setLeftTab("tracks")}
                title="Tracks"
              >
                <FontAwesomeIcon icon={faMusic} />
              </button>
              <button
                className={`tab-btn ${c.leftTab === "files" ? "active" : ""}`}
                onClick={() => c.setLeftTab("files")}
                title="Files"
              >
                <FontAwesomeIcon icon={faFolder} />
              </button>
              <button
                className={`tab-btn ${c.leftTab === "settings" ? "active" : ""}`}
                onClick={() => c.setLeftTab("settings")}
                title="Settings"
              >
                <FontAwesomeIcon icon={faGear} />
              </button>
              <div className="tab-separator"></div>
              <button
                className="tab-btn"
                onClick={() => c.setTracksListCollapsed(!c.tracksListCollapsed)}
                title="Collapse tracks list"
              >
                <FontAwesomeIcon
                  icon={c.tracksListCollapsed ? faPlus : faMinus}
                />
              </button>
            </div>
            {!c.tracksListCollapsed && (
              <>
                {confirmBoxes.map((b) => (
                  <div key={b.key}>{b.el}</div>
                ))}
                {c.leftTab === "tracks" && (
                  <MainTracksTab
                    tracks={fullTracks}
                    parentElement={appLeftSide}
                  />
                )}
                {c.leftTab === "settings" && <SettingsTab />}
                {c.leftTab === "files" && <FileBrowserTab />}
              </>
            )}
          </div>
          <div
            id="app-right-side"
            style={{ display: c.queue.tracks.length > 0 ? "block" : "none" }}
            ref={appRightSide}
          >
            <div className="tab-bar">
              <div className="tab-separator"></div>
              <button
                className="tab-btn"
                onClick={() => c.setQueueCollapsed(!c.queueCollapsed)}
                title="Collapse queue"
              >
                <FontAwesomeIcon icon={c.queueCollapsed ? faPlus : faMinus} />
              </button>
            </div>
            {trackQueue}
          </div>
        </div>
        <div id="app-bottom">
          <MusicPlayer />
        </div>
      </div>
    </AppContext>
  );
}
