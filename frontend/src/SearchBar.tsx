import { useContext, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBackwardStep, faForwardStep, faSearch, faDownload } from '@fortawesome/free-solid-svg-icons';
import { useBackForward } from './MusicPlayer';
import { useWindowWidth, PLAYER_COLLAPSE_AT_WIDTH } from './responsive';
import { AppContext } from './AppState';
import { TrackData } from './Track';
import { HOST } from './apiserver';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './SearchBar.css';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

function SearchBar({ searchQuery, setSearchQuery }: SearchBarProps) {
  const c = useContext(AppContext)!;
  const [inputValue, setInputValue] = useState(searchQuery);
  const { handleBack, handleForward, isBackDisabled, isForwardDisabled } = useBackForward(c);
  const windowWidth = useWindowWidth();
  const collapsed = windowWidth < PLAYER_COLLAPSE_AT_WIDTH;

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const confirmTrackDownload = async (url: string) => {
    try {
      const response = await fetch(`${HOST}/track/:external/${url}`);
      if (!response.ok) {
        toast.error('Unable to get track data');
        return;
      }
      const trackData: TrackData = await response.json();
      c.addConfirmBox(
        <div>
          <p>Download this track?</p>
          <button onClick={() => alert(`Downloading: ${trackData.name}`)}>Yes</button>
        </div>
      );
    } catch {
      toast.error('Unable to get track data');
    }
  };

  const isValidUrl = inputValue.startsWith('http://') || inputValue.startsWith('https://');

  return (
    <form className="search-bar" onSubmit={e => {
      e.preventDefault();
      setSearchQuery(inputValue);
    }}>
      <input
        type="text"
        placeholder="Search tracks..."
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
        }}
        className="search-input"
      />
      <button type="submit" className="icon-btn">
        <FontAwesomeIcon icon={faSearch} />
      </button>
      {collapsed && (
        <button 
          className="icon-btn btn-prev-song" 
          onClick={handleBack}
          disabled={isBackDisabled}
        >
          <FontAwesomeIcon icon={faBackwardStep} />
        </button>
      )}
      {collapsed && (
        <button 
          className="icon-btn btn-next-song" 
          onClick={handleForward}
          disabled={isForwardDisabled}
        >
          <FontAwesomeIcon icon={faForwardStep} />
        </button>
      )}
      <button 
        type="button"
        className="icon-btn btn-download" 
        onClick={() => confirmTrackDownload(inputValue)}
        disabled={!isValidUrl}
      >
        <FontAwesomeIcon icon={faDownload} />
      </button>
    </form>
  );
}

export default SearchBar;
