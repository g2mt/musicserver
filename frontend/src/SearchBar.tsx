import { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faDownload,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { AppContext } from "./AppState";
import { Track } from "./Track";
import { fetchAPI } from "./apiserver";
import { toast } from "react-toastify";
import ConfirmBox from "./ConfirmBox";
import type { TrackData } from "./TrackData";

import "./SearchBar.css";

function SearchBar() {
  const c = useContext(AppContext)!;
  const [inputValue, setInputValue] = useState(c.searchQuery);

  useEffect(() => {
    if (c.oldSearchQuery.current !== null) return; // still being processed
    setInputValue(c.searchQuery);
  }, [c.searchQuery, c.oldSearchQuery.current]);

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
    inputValue.startsWith("http://") || inputValue.startsWith("https://");

  return (
    <form
      className="search-bar"
      onSubmit={(e) => {
        e.preventDefault();
        c.setSearchQuery(inputValue);
      }}
    >
      <div className="search-input-wrapper">
        <input
          type="search"
          placeholder="Search tracks..."
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          className="search-input"
        />
        {inputValue && (
          <button
            type="button"
            className="clear-btn"
            onClick={() => {
              setInputValue("");
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
      <button
        type="button"
        className="icon-btn btn-download"
        title='Paste a URL beginning with "http:" or "https:" to download it.'
        onClick={() => confirmTrackDownload(inputValue)}
        disabled={!isValidUrl}
      >
        <FontAwesomeIcon icon={faDownload} />
      </button>
    </form>
  );
}

export default SearchBar;
