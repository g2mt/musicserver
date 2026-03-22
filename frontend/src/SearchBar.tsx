import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import './SearchBar.css';
import './common.css';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

function SearchBar({ searchQuery, setSearchQuery }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);

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
      <button type="submit" className="btn">
        <FontAwesomeIcon icon={faSearch} />
      </button>
    </form>
  );
}

export default SearchBar;
