import {
  useContext,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faDownload,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { AppContext } from "./AppState";
import { Track } from "./Track";
import { fetchAPI } from "./apiServer";
import { toast } from "react-toastify";
import ConfirmBox from "./ConfirmBox";
import type { TrackData } from "./TrackData";

import "./SearchBar.css";

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

  const confirmTrackDownload = async (url: string) => {
    const encodedUrl = encodeURIComponent(url);
    try {
      const trackData: TrackData = await fetchAPI(
        `/track/:external/${encodedUrl}`,
      );
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
        >
          <p>Download this track?</p>
          <Track highlighted={true} track={trackData} />
        </ConfirmBox>,
      );
    } catch (e) {
      toast.error("Unable to get track data");
    }
  };

  const isValidUrl =
    searchInput.startsWith("http://") || searchInput.startsWith("https://");

  return (
    <form
      className="search-bar"
      onSubmit={(e) => {
        e.preventDefault();
        c.setSearchQuery(searchInput);
      }}
    >
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
              c.setSearchQuery("");
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
          onClick={() => confirmTrackDownload(searchInput)}
          disabled={!isValidUrl}
        >
          <FontAwesomeIcon icon={faDownload} />
        </button>
      )}
    </form>
  );
}

export default SearchBar;
