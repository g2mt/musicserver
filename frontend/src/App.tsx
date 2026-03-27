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
import { AppContext, saveConfig, type AppState } from "./AppState";
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
  const a = {} as AppState;

  // State variables
  [a.currentTrack, a.setCurrentTrack] = useState<TrackData | null>(null);
  [a.isPlaying, a.setIsPlaying] = useState(false);
  [a.progress, a.setProgress] = useState(0);
  [a.duration, a.setDuration] = useState(0);
  [a.volume, a.setVolume] = useState(1);
  [a.muted, a.setMuted] = useState(false);
  [a.enqueuedTrackIndex, a.setEnqueuedTrackIndex] = useState<number | null>(
    null,
  );
  [a.darkMode, a.setDarkMode] = useState(false);
  [a.showBlurredCover, a.setShowBlurredCover] = useState(true);

  useEffect(() => {
    window.addEventListener("beforeunload", () => {
      saveConfig(a);
    });
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    a.setDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", a.darkMode);
  }, [a.darkMode]);

  // Media Session API
  const { handleBack, handleForward } = useBackForward(a);
  useEffect(() => {
    if ("mediaSession" in navigator && a.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: a.currentTrack.name,
        artist: a.currentTrack.artist,
        album: a.currentTrack.album,
        artwork: [{ src: getTrackCover(a.currentTrack) }],
      });

      navigator.mediaSession.setActionHandler("play", () =>
        a.setIsPlaying(true),
      );
      navigator.mediaSession.setActionHandler("pause", () =>
        a.setIsPlaying(false),
      );
      navigator.mediaSession.setActionHandler("previoustrack", handleBack);
      navigator.mediaSession.setActionHandler("nexttrack", handleForward);
      navigator.mediaSession.setActionHandler("stop", null);
    }
  }, [a.currentTrack]);

  // Update body background when current track changes
  const overlay = document.getElementById("background-overlay")!;
  useEffect(() => {
    if (a.currentTrack && a.darkMode && a.showBlurredCover) {
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
      const cover = getTrackCover(a.currentTrack);
      if (image && cover !== image.getAttribute("href")) {
        image.setAttribute("href", cover);
      }
    } else if (overlay.childElementCount > 0) {
      overlay.innerHTML = "";
    }
  }, [a.currentTrack, a.darkMode]);

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
  [a.searchQuery, a.setSearchQuery] = useState(
    () => initialHashParams.get("q") ?? "",
  );
  a.previousWorkingValue = useRef("");
  const didSetToPreviousWorkingValue = useRef(false);
  useEffect(() => {
    function onHashchange() {
      const hashParams = getHashParams();
      a.setSearchQuery(hashParams.get("q") ?? "");
    }

    window.addEventListener("hashchange", onHashchange);
    return () => {
      window.removeEventListener("hashchange", onHashchange);
    };
  });
  useEffect(() => {
    setHashParam("q", a.searchQuery);
    if (didSetToPreviousWorkingValue.current) {
      didSetToPreviousWorkingValue.current = false;
      return;
    }
    fetch(`${HOST}/track?q=${encodeURIComponent(a.searchQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setFullTracksFromData(data);
        if (data === null || data.length === 0) {
          if (!didSetToPreviousWorkingValue.current) {
            didSetToPreviousWorkingValue.current = true;
            a.setSearchQuery(a.previousWorkingValue.current);
            a.previousWorkingValue.current = "";
          }
        } else {
          a.previousWorkingValue.current = a.searchQuery;
        }
      });
  }, [a.searchQuery]);

  // Confirm boxes
  const [confirmBoxes, setConfirmBoxes] = useState<
    {
      key: number;
      el: React.ReactNode;
    }[]
  >([]);
  let confirmBoxesCounter = useRef(0);
  a.addConfirmBox = (confirmBox: React.ReactNode) => {
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
          a.setIsPlaying((prev) => !prev);
          break;
        case "m":
          e.preventDefault();
          a.setMuted((prev) => !prev);
          break;
        case "j":
          e.preventDefault();
          a.setProgress((prev) => Math.max(0, prev - 10));
          break;
        case "l":
          e.preventDefault();
          a.setProgress((prev) => Math.min(a.duration, prev + 10));
          break;
        case "(":
          e.preventDefault();
          a.setVolume((prev) => Math.max(0, prev - 0.05));
          a.setMuted(false);
          break;
        case ")":
          e.preventDefault();
          a.setVolume((prev) => Math.min(1, prev + 0.05));
          a.setMuted(false);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [a.duration]);

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
  [a.enqueuedTracks, a.setEnqueuedTracks] = useState<TrackData[]>([]);
  a.enqueueTrack = (track: TrackData) => {
    a.setEnqueuedTracks([...a.enqueuedTracks, track]);
  };
  a.unqueueTrack = (index: number) => {
    a.setEnqueuedTracks((prev) => prev.filter((_, i) => i !== index));
    // If we remove a track before the current index, adjust the index
    if (a.enqueuedTrackIndex !== null && index < a.enqueuedTrackIndex) {
      a.setEnqueuedTrackIndex((prev) => (prev ?? 1) - 1);
    } else if (index === a.enqueuedTrackIndex) {
      // If we remove the currently highlighted track, reset index
      a.setEnqueuedTrackIndex(null);
    }
  };

  // Left-side tab
  const [leftTab, setLeftTab] = useState<"tracks" | "settings" | "files">("tracks");

  return (
    <AppContext value={a}>
      <ToastContainer position="bottom-right" theme="dark" />
      <div className="app-layout">
        <div className="search-bar-container">
          <SearchBar
            searchQuery={a.searchQuery}
            setSearchQuery={a.setSearchQuery}
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
                className={`tab-btn ${leftTab === "settings" ? "active" : ""}`}
                onClick={() => setLeftTab("settings")}
                title="Settings"
              >
                <FontAwesomeIcon icon={faGear} />
              </button>
              <button
                className={`tab-btn ${leftTab === "files" ? "active" : ""}`}
                onClick={() => setLeftTab("files")}
                title="Files"
              >
                <FontAwesomeIcon icon={faFolder} />
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
            style={{ display: a.enqueuedTracks.length > 0 ? "block" : "none" }}
          >
            <TrackList
              tracks={a.enqueuedTracks}
              unqueueTrack={a.unqueueTrack}
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
