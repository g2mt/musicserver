import { faHistory, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect, useState } from "react";

import { AppContext } from "src/AppState";
import { COLLAPSE_AT_WIDTH, useWindowWidth } from "src/responsive";
import { Settings } from "src/settings";

import "./SearchSuggestions.css";

interface Suggestion {
  q: string;
  lastUsed: number;
}

interface SearchSuggestionsProps {
  searchInput: string;
  setSearchInput: (val: string) => void;
  searchBarRef: React.RefObject<HTMLInputElement | null>;
}

export function SearchSuggestions({
  searchInput,
  setSearchInput,
  searchBarRef,
}: SearchSuggestionsProps) {
  const c = useContext(AppContext);
  const windowWidth = useWindowWidth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const filtered = suggestions.filter((s) =>
    s.q.toLowerCase().includes(searchInput.toLowerCase()),
  );

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchInput]);

  useEffect(() => {
    const saved = Settings.getItem("searchSuggestions");
    if (saved) {
      try {
        setSuggestions(JSON.parse(saved));
      } catch (e) {
        setSuggestions([]);
      }
    }
  }, []);

  useEffect(() => {
    const input = searchBarRef.current;
    if (!input) return;

    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isFocused || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex(
          (prev) => (prev - 1 + filtered.length) % filtered.length,
        );
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        selectSuggestion(filtered[highlightedIndex].q);
      }
    };

    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    input.addEventListener("keydown", onKeyDown);
    return () => {
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("keydown", onKeyDown);
    };
  }, [searchBarRef, isFocused, highlightedIndex, filtered]);

  // Update history when a search is performed
  useEffect(() => {
    if (!c?.searchQuery.q) return;

    setSuggestions((prev) => {
      const filtered = prev.filter((s) => s.q !== c.searchQuery.q);
      const updated = [
        { q: c.searchQuery.q, lastUsed: Date.now() },
        ...filtered,
      ].slice(0, c.searchHistoryLimit);
      Settings.setItem("searchSuggestions", JSON.stringify(updated));
      return updated;
    });
  }, [c?.searchQuery, c?.searchHistoryLimit]);

  const removeSuggestion = (e: React.MouseEvent, q: string) => {
    e.stopPropagation();
    setSuggestions((prev) => {
      const updated = prev.filter((s) => s.q !== q);
      Settings.setItem("searchSuggestions", JSON.stringify(updated));
      return updated;
    });
  };

  const selectSuggestion = (q: string) => {
    setSearchInput(q);
    c?.setSearchQuery((prev) => ({ ...prev, q }));
    setIsFocused(false);
  };

  if (!isFocused || filtered.length === 0) return null;

  const isCollapsed = windowWidth < COLLAPSE_AT_WIDTH;

  let style: React.CSSProperties = {};
  if (isCollapsed) {
    style = { top: "var(--search-bar-height)" };
  } else if (searchBarRef.current) {
    const rect = searchBarRef.current.getBoundingClientRect();
    style = {
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
      transform: "none",
      maxWidth: "none",
    };
  }

  return (
    <div
      className={`search-suggestions menu ${isCollapsed ? "collapsed" : ""}`}
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.map((s, index) => (
        <div
          key={s.q}
          className={`menu-item suggestion-item ${index === highlightedIndex ? "highlighted" : ""}`}
          onClick={() => selectSuggestion(s.q)}
          onMouseEnter={() => setHighlightedIndex(index)}
        >
          <FontAwesomeIcon icon={faHistory} className="suggestion-icon" />
          <span className="suggestion-text">{s.q}</span>
          <button
            className="suggestion-remove"
            onClick={(e) => removeSuggestion(e, s.q)}
            title="Remove from history"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ))}
    </div>
  );
}
