import {
  faPencil,
  faPlus,
  faTimes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useRef, useState } from "react";

import { AppContext, type Bookmark, saveConfig } from "src/AppState";
import ConfirmBox from "src/ConfirmBox";
import { ContextMenuItem, toggleContextMenu } from "src/ContextMenu";

import "./BookmarksTab.css";

interface BookmarkRowProps {
  bookmark: Bookmark;
  index: number;
}

function RenameBookmarkBox({
  name,
  onAccept,
}: {
  name: string;
  onAccept: (newName: string) => void;
}) {
  const [newName, setNewName] = useState(name);
  return (
    <ConfirmBox onAccept={() => onAccept(newName)}>
      <label>
        Rename bookmark:
        <br />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
        />
      </label>
    </ConfirmBox>
  );
}

function BookmarkRow({ bookmark, index }: BookmarkRowProps) {
  const c = useContext(AppContext)!;
  const confirmBoxIndexes = useRef(new Set<number>());

  useEffect(() => {
    return () => {
      for (const idx of confirmBoxIndexes.current) {
        c.removeConfirmBox(idx);
      }
      confirmBoxIndexes.current.clear();
    };
  }, [c.bookmarks]);

  const handleRename = () => {
    const idx = c.addConfirmBox(
      <RenameBookmarkBox
        name={bookmark.name}
        onAccept={(newName) => {
          const newBookmarks = [...c.bookmarks];
          newBookmarks[index] = { ...newBookmarks[index], name: newName };
          c.setBookmarks(newBookmarks);
        }}
      />,
    );
    confirmBoxIndexes.current.add(idx);
  };

  const handleDelete = () => {
    c.setBookmarks(c.bookmarks.filter((_, i) => i !== index));
  };

  return (
    <li
      className="bookmark-item"
      onContextMenu={(e) => {
        e.preventDefault();
        toggleContextMenu(
          e.currentTarget,
          <>
            <ContextMenuItem onClick={handleRename} icon={faPencil}>
              Rename
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDelete} icon={faTrash}>
              Delete
            </ContextMenuItem>
          </>,
        );
      }}
    >
      <button
        className="bookmark-content"
        onClick={(e) => {
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
        onClick={handleDelete}
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
        <button className="btn" onClick={handleAdd} disabled={!c.searchQuery.q}>
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
