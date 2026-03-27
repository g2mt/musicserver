import TrackList from "./TrackList";
import { MainTracksTab } from "./MainTracksTab";
import SettingsTab from "./SettingsTab";
import FileBrowserTab from "./FileBrowserTab";
import { MusicPlayer } from "./MusicPlayer";
import SearchBar from "./SearchBar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTrackCover } from "./Track";
import { HOST } from "./apiserver";
import { faMusic, faGear, faFolder } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { toast, ToastContainer } from "react-toastify";
import { AppContext, mergeConfig, saveConfig, type AppState } from "./AppState";
import type { TrackData } from "./TrackData";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

export function useBackForward(c: AppState) {
  const isBackDisabled = useMemo(
    () => c.enqueuedTrackIndex === null || c.enqueuedTrackIndex <= 0,
    [c.enqueuedTrackIndex],
  );
  const isForwardDisabled = useMemo(
    () =>
      c.enqueuedTrackIndex === null ||
      c.enqueuedTrackIndex + 1 >= c.enqueuedTracks.length,
    [c.enqueuedTrackIndex, c.enqueuedTracks],
  );

  function handleBack() {
    if (isBackDisabled) return;
    const prevIndex = (c.enqueuedTrackIndex ?? 0) - 1;
    c.setEnqueuedTrackIndex(prevIndex);
    c.setCurrentTrack(c.enqueuedTracks[prevIndex]);
  }

  function handleForward() {
    if (isForwardDisabled) return;
    const nextIndex = (c.enqueuedTrackIndex ?? 0) + 1;
    c.setEnqueuedTrackIndex(nextIndex);
    c.setCurrentTrack(c.enqueuedTracks[nextIndex]);
  }

  return {
    handleBack,
    handleForward,
    isBackDisabled,
    isForwardDisabled,
  };
}

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

  // Media Session API
  const { handleBack, handleForward } = useBackForward(c);
  useEffect(() => {
    if ("mediaSession" in navigator && c.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: c.currentTrack.name,
        artist: c.currentTrack.artist,
        album: c.currentTrack.album,
        artwork: [{ src: getTrackCover(c.currentTrack) }],
      });

      navigator.mediaSession.setActionHandler("play", () =>
        c.setIsPlaying(true),
      );
      navigator.mediaSession.setActionHandler("pause", () =>
        c.setIsPlaying(false),
      );
      navigator.mediaSession.setActionHandler("previoustrack", handleBack);
      navigator.mediaSession.setActionHandler("nexttrack", handleForward);
      navigator.mediaSession.setActionHandler("stop", null);
    }
  }, [c.currentTrack]);

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

  useEffect(() => {
    fetch(`${HOST}/track`)
      .then((res) => res.json())
      .then((data) => setFullTracksFromData(data));
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
  c.previousWorkingValue = useRef("");
  const didSetToPreviousWorkingValue = useRef(false);
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
    setHashParam("q", c.searchQuery);
    if (didSetToPreviousWorkingValue.current) {
      didSetToPreviousWorkingValue.current = false;
      return;
    }
    fetch(`${HOST}/track?q=${encodeURIComponent(c.searchQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setFullTracksFromData(data);
        if (data === null || data.length === 0) {
          if (!didSetToPreviousWorkingValue.current) {
            didSetToPreviousWorkingValue.current = true;
            c.setSearchQuery(c.previousWorkingValue.current);
            c.previousWorkingValue.current = "";
          }
        } else {
          c.previousWorkingValue.current = c.searchQuery;
        }
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
      // Ignore if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
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
          c.setProgress((prev) => Math.max(0, prev - 10));
          break;
        case "l":
          e.preventDefault();
          c.setProgress((prev) => Math.min(c.duration, prev + 10));
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
  }, [c.duration]);

  // Tracks
  const [fullTracks, setFullTracks] = useState<TrackData[]>([]);

  const setFullTracksFromData = (data: any) => {
    if (data === null || data.length === 0) {
      toast.warn("No tracks found");
    } else {
      setFullTracks(data);
    }
  };

  // Track queue
  [c.enqueuedTracks, c.setEnqueuedTracks] = useState<TrackData[]>([]);
  c.enqueueTrack = (track: TrackData|TrackData[]) => {
    if (Array.isArray(track)) {
      c.setEnqueuedTracks([...c.enqueuedTracks, ...track]);
    } else {
      c.setEnqueuedTracks([...c.enqueuedTracks, track]);
    }
  };
  c.unqueueTrack = (index: number) => {
    c.setEnqueuedTracks((prev) => prev.filter((_, i) => i !== index));
    // If we remove a track before the current index, adjust the index
    if (c.enqueuedTrackIndex !== null && index < c.enqueuedTrackIndex) {
      c.setEnqueuedTrackIndex((prev) => (prev ?? 1) - 1);
    } else if (index === c.enqueuedTrackIndex) {
      // If we remove the currently highlighted track, reset index
      c.setEnqueuedTrackIndex(null);
    }
  };

  // Left-side tab
  const [leftTab, setLeftTab] = useState<"tracks" | "settings" | "files">(
    "tracks",
  );

  useEffect(() => {
    mergeConfig(c);
  }, []);

  return (
    <AppContext value={c}>
      <ToastContainer position="bottom-right" theme="dark" />
      <div className="app-layout">
        <div className="search-bar-container">
          <SearchBar
            searchQuery={c.searchQuery}
            setSearchQuery={c.setSearchQuery}
          />
        </div>
        <div className="app-main">
          <div className="left-side">
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
            </div>
            {confirmBoxes.map((b) => (
              <div key={b.key}>{b.el}</div>
            ))}
            {leftTab === "tracks" && <MainTracksTab tracks={fullTracks} />}
            {leftTab === "settings" && <SettingsTab />}
            {leftTab === "files" && <FileBrowserTab />}
          </div>
          <div
            className="right-side"
            style={{ display: c.enqueuedTracks.length > 0 ? "block" : "none" }}
          >
            <TrackList
              tracks={c.enqueuedTracks}
              canUnqueue={true}
            />
          </div>
        </div>
        <div className="music-player">
          <MusicPlayer />
        </div>
      </div>
    </AppContext>
  );
}
