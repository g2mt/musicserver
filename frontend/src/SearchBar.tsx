import {
  useContext,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faDownload,
  faTimes,
  faHome,
  faChevronUp,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { AppContext, type AppState } from "./AppState";
import { TrackList } from "./TrackList";
import { fetchAPI } from "./apiServer";
import { toast } from "react-toastify";
import ConfirmBox from "./ConfirmBox";
import type { TrackData } from "./TrackData";

import "./SearchBar.css";

async function confirmTrackDownload(c: AppState, url: string) {
  const encodedUrl = encodeURIComponent(url);
  let tracks: TrackData[];
  try {
    tracks = await fetchAPI(`/track/:external/${encodedUrl}`);
  } catch (e) {
    toast.error("Unable to get track data");
    return;
  }
  const [externalTracksCollapsed, setExternalTracksCollapsed] = useState(false);
  c.addConfirmBox(
    <ConfirmBox
      onAccept={() => {
        toast.info(
          <>
            Download for <b>{url}</b> started
          </>,
        );
        fetchAPI(`/track/:external/${encodedUrl}`, undefined, "POST")
          .then(() =>
            toast.success(
              <>
                Download for <b>{url}</b> completed
              </>,
            ),
          )
          .catch(() =>
            toast.error(
              <>
                Download for <b>{url}</b> failed
              </>,
            ),
          );
      }}
      titleButtons={
        <button
          className="btn-icon"
          onClick={() => setExternalTracksCollapsed((prev) => !prev)}
        >
          <FontAwesomeIcon
            icon={externalTracksCollapsed ? faChevronDown : faChevronUp}
          />
        </button>
      }
    >
      <p>Download this track?</p>
      {!externalTracksCollapsed && (
        <TrackList tracks={tracks} parentElement={{ current: null }} />
      )}
    </ConfirmBox>,
  );
}

function SearchBar({
  searchInput,
  setSearchInput,
  searchBarRef,
}: {
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
  searchBarRef: RefObject<HTMLInputElement | null>;
}) {
  const c = useContext(AppContext)!;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    c.setSearchQuery((old) => ({ ...old, q: searchInput }));
  };

  const isValidUrl =
    searchInput.startsWith("http://") || searchInput.startsWith("https://");

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <button
        type="button"
        className="icon-btn"
        onClick={c.scrollToTop}
        title="Go to top"
      >
        <FontAwesomeIcon icon={faHome} />
      </button>
      <div className="search-input-wrapper">
        <input
          type="search"
          placeholder="Search tracks..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
          }}
          className="search-input"
          ref={searchBarRef}
        />
        {searchInput && (
          <button
            type="button"
            className="clear-btn"
            onClick={() => {
              setSearchInput("");
              c.setSearchQuery((old) => ({ ...old, q: "" }));
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>
      <button type="submit" className="icon-btn">
        <FontAwesomeIcon icon={faSearch} />
      </button>
      {c.props && c.props.config.media_downloader && (
        <button
          type="button"
          className="icon-btn btn-download"
          title='Paste a URL beginning with "http:" or "https:" to download it.'
          onClick={() => confirmTrackDownload(c, searchInput)}
          disabled={!isValidUrl}
        >
          <FontAwesomeIcon icon={faDownload} />
        </button>
      )}
    </form>
  );
}

export default SearchBar;
