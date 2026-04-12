import React, { useEffect, useState, useContext } from "react";
import { AppContext } from "./AppState";
import { Settings } from "./settings";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faHistory } from "@fortawesome/free-solid-svg-icons";
import { COLLAPSE_AT_WIDTH, useWindowWidth } from "./responsive";
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

    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    return () => {
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
    };
  }, [searchBarRef]);

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

  if (!isFocused || suggestions.length === 0) return null;

  const filtered = suggestions.filter((s) =>
    s.q.toLowerCase().includes(searchInput.toLowerCase()),
  );

  if (filtered.length === 0) return null;

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
      className={`search-suggestions ${isCollapsed ? "collapsed" : ""}`}
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.map((s) => (
        <div
          key={s.q}
          className="menu-item suggestion-item"
          onClick={() => selectSuggestion(s.q)}
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
