import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useState } from "react";

import { AppContext, type Bookmark, saveConfig } from "src/AppState";

import "./BookmarksTab.css";

interface BookmarkRowProps {
  bookmark: Bookmark;
  index: number;
}

function BookmarkRow({ bookmark, index }: BookmarkRowProps) {
  const c = useContext(AppContext)!;

  return (
    <li className="bookmark-item">
      <button
        className="bookmark-content"
        onClick={e => {
          e.preventDefault();
          c.interactiveSetSearchQuery(bookmark.query);
          c.setLeftTab("tracks");
        }}
      >
        {bookmark.name ? (
          <>
            <span className="bookmark-name">{bookmark.name}</span>
            <span className="bookmark-query">{bookmark.query}</span>
          </>
        ) : (
          <span className="bookmark-query">{bookmark.query}</span>
        )}
      </button>
      <button
        className="icon-btn bookmark-remove"
        onClick={() => {
          c.setBookmarks(c.bookmarks.filter((_, i) => i !== index));
        }}
        title="Remove bookmark"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </li>
  );
}

export function BookmarksTab() {
  const c = useContext(AppContext)!;
  const [bookmarkName, setBookmarkName] = useState("");

  useEffect(() => {
    saveConfig(c);
  }, [c.bookmarks]);

  const handleAdd = () => {
    const newBookmark: Bookmark = {
      name: bookmarkName.trim(),
      query: c.searchQuery.q,
    };
    c.setBookmarks([...c.bookmarks, newBookmark]);
    setBookmarkName("");
  };

  return (
    <div className="bookmarks-tab">
      <div className="bookmarks-add">
        <input
          type="text"
          placeholder="Bookmark name"
          value={bookmarkName}
          onChange={(e) => setBookmarkName(e.target.value)}
        />
        <button
          className="btn"
          onClick={handleAdd}
          disabled={!c.searchQuery.q}
        >
          <FontAwesomeIcon icon={faPlus} /> Add
        </button>
      </div>
      {c.bookmarks.length === 0 ? (
        <div className="bookmarks-empty">No bookmarks</div>
      ) : (
        <ul className="bookmarks-list">
          {c.bookmarks.map((bookmark, i) => (
            <BookmarkRow key={i} bookmark={bookmark} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
