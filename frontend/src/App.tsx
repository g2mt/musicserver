import TrackList from "./TrackList";
import { MainTracksTab } from "./MainTracksTab";
import SettingsTab from "./SettingsTab";
import FileBrowserTab from "./FileBrowserTab";
import { MusicPlayer } from "./MusicPlayer";
import SearchBar from "./SearchBar";
import React, { useEffect, useRef, useState } from "react";
import { getTrackCover } from "./Track";
import { fetchAPI } from "./apiserver";
import {
  faMusic,
  faGear,
  faFolder,
  faArrowDown,
  faArrowUp,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { toast, ToastContainer } from "react-toastify";
import { ContextMenu } from "./ContextMenu";
import { AppContext, mergeConfig, saveConfig, type AppState } from "./AppState";
import type { TrackData } from "./TrackData";
import { PLAYER_COLLAPSE_AT_WIDTH, useWindowWidth } from "./responsive";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

export function App() {
  const c = {} as AppState;

  // State variables
  [c.currentTrack, c.setCurrentTrack] = useState<TrackData | null>(null);
  [c.isPlaying, c.setIsPlaying] = useState(false);
  [c.progress, c.setProgress] = useState(0);
  [c.duration, c.setDuration] = useState(0);
  [c.volume, c.setVolume] = useState(1);
  [c.muted, c.setMuted] = useState(false);
  [c.enqueuedTrackIndex, c.setEnqueuedTrackIndex] = useState<number | null>(
    null,
  );
  [c.darkMode, c.setDarkMode] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  [c.showBlurredCover, c.setShowBlurredCover] = useState(true);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", c.darkMode);
  }, [c.darkMode]);

  // Update body background when current track changes
  const overlay = document.getElementById("background-overlay")!;
  useEffect(() => {
    if (c.currentTrack && c.darkMode && c.showBlurredCover) {
      if (overlay.childElementCount === 0) {
        overlay.innerHTML = `
        <style>:root { fill: #000; stroke: none; }</style>
        <filter id="blur">
          <feGaussianBlur stdDeviation="30" edgeMode="wrap" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.1"/>
            <feFuncG type="linear" slope="0.1"/>
            <feFuncB type="linear" slope="0.1"/>
            <feFuncA type="linear" slope="1"/>
          </feComponentTransfer>
        </filter>
        <image width="100%" href="" filter="url(#blur)"/>`;
      }
      const image = overlay.querySelector("image");
      const cover = getTrackCover(c.currentTrack);
      if (image && cover !== image.getAttribute("href")) {
        image.setAttribute("href", cover);
      }
    } else if (overlay.childElementCount > 0) {
      overlay.innerHTML = "";
    }
  }, [c.currentTrack, c.darkMode]);

  c.onRescanned = () => {
    fetchAPI("/track")
      .then((data) => setFullTracks(data))
      .catch(() => setFullTracks([]));
  };
  useEffect(() => c.onRescanned(), []);

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
  useEffect(() => {
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
  }, [c.searchQuery]);

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

  // Keyboard shortcuts
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
          c.setIsPlaying((prev) => !prev);
          break;
        case "m":
          e.preventDefault();
          c.setMuted((prev) => !prev);
          break;
        case "j":
          e.preventDefault();
          c.setProgress((prev) => prev - 10);
          break;
        case "l":
          e.preventDefault();
          c.setProgress((prev) => prev + 10);
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

  // Tracks
  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);

  // Track queue
  [c.enqueuedTracks, c.setEnqueuedTracks] = useState<TrackData[]>([]);
  c.enqueueTrack = (track: TrackData | TrackData[]) => {
    if (Array.isArray(track)) {
      c.setEnqueuedTracks([...c.enqueuedTracks, ...track]);
    } else {
      c.setEnqueuedTracks([...c.enqueuedTracks, track]);
    }
  };
  c.unqueueTrack = (index?: number) => {
    if (typeof index === "number") {
      c.setEnqueuedTracks((prev) => prev.filter((_, i) => i !== index));
      // If we remove a track before the current index, adjust the index
      if (c.enqueuedTrackIndex !== null && index < c.enqueuedTrackIndex) {
        c.setEnqueuedTrackIndex((prev) => (prev ?? 1) - 1);
      } else if (index === c.enqueuedTrackIndex) {
        // If we remove the currently highlighted track, reset index
        c.setEnqueuedTrackIndex(null);
      }
    } else {
      c.setEnqueuedTracks([]);
      c.setEnqueuedTrackIndex(null);
    }
  };

  // Left-side tab
  const [leftTab, setLeftTab] = useState<"tracks" | "settings" | "files">(
    "tracks",
  );
  c.showAllTracks = () => setLeftTab("tracks");

  useEffect(() => {
    mergeConfig(c);
  }, []);

  // Scroll navigation
  const scrollToRightSide = () => {
    document.getElementById("app-right-side")?.scrollIntoView();
  };

  const scrollToLeftSide = () => {
    document.getElementById("app-left-side")?.scrollIntoView();
  };

  const windowWidth = useWindowWidth();
  useEffect(() => {
    document.body.classList.toggle(
      "minimized",
      windowWidth < PLAYER_COLLAPSE_AT_WIDTH,
    );
  }, [windowWidth]);

  useEffect(() => {
    function onBeforeUnload() {
      saveConfig(c);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return (
    <AppContext value={c}>
      <ToastContainer position="bottom-right" theme="dark" />
      <ContextMenu />
      <div className="app-layout">
        <div className="search-bar-container">
          <SearchBar />
        </div>
        <div className="app-main">
          <div id="app-left-side">
            <div className="tab-bar">
              <button
                className={`tab-btn ${leftTab === "tracks" ? "active" : ""}`}
                onClick={() => setLeftTab("tracks")}
                title="Tracks"
              >
                <FontAwesomeIcon icon={faMusic} />
              </button>
              <button
                className={`tab-btn ${leftTab === "files" ? "active" : ""}`}
                onClick={() => setLeftTab("files")}
                title="Files"
              >
                <FontAwesomeIcon icon={faFolder} />
              </button>
              <button
                className={`tab-btn ${leftTab === "settings" ? "active" : ""}`}
                onClick={() => setLeftTab("settings")}
                title="Settings"
              >
                <FontAwesomeIcon icon={faGear} />
              </button>
              <div className="tab-separator"></div>
              <button
                className="tab-btn"
                onClick={scrollToRightSide}
                title="Go to queue"
              >
                <FontAwesomeIcon icon={faArrowDown} />
              </button>
            </div>
            {confirmBoxes.map((b) => (
              <div key={b.key}>{b.el}</div>
            ))}
            {leftTab === "tracks" && <MainTracksTab tracks={fullTracks} />}
            {leftTab === "settings" && <SettingsTab />}
            {leftTab === "files" && <FileBrowserTab />}
          </div>
          <div
            id="app-right-side"
            style={{ display: c.enqueuedTracks.length > 0 ? "block" : "none" }}
          >
            <div>
              <button
                className="icon-btn"
                onClick={scrollToLeftSide}
                title="Go to tracks"
                style={{ position: "sticky", top: 0, float: "right" }}
              >
                <FontAwesomeIcon icon={faArrowUp} />
              </button>
            </div>
            <TrackList tracks={c.enqueuedTracks} canUnqueue={true} />
          </div>
        </div>
        <div className="music-player">
          <MusicPlayer />
        </div>
      </div>
    </AppContext>
  );
}
