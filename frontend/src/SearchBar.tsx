import { useContext, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBackwardStep, faForwardStep, faSearch } from '@fortawesome/free-solid-svg-icons';
import { MusicPlayerContext, useBackForward } from './MusicPlayer';
import { useWindowWidth } from './useWindowWidth';
import { PLAYER_COLLAPSE_AT_WIDTH } from './responsive';

import './SearchBar.css';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

function SearchBar({ searchQuery, setSearchQuery }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const c = useContext(MusicPlayerContext)!;
  const { handleBack, handleForward, isBackDisabled, isForwardDisabled } = useBackForward(c);
  const windowWidth = useWindowWidth();
  const collapsed = windowWidth < PLAYER_COLLAPSE_AT_WIDTH;

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
    </form>
  );
}

export default SearchBar;
