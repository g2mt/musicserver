import { useContext } from 'react';
import { HOST } from './apiserver';
import { toast } from 'react-toastify';
import { faRotate, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ProgressTable from './ProgressTable';
import { AppContext } from './AppState';
import './SettingsTab.css';

function SettingsTab() {
  const c = useContext(AppContext)!;

  function rescanMusic() {
    fetch(`${HOST}/track`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error();
        toast.success('Syncing complete');
      })
      .catch(() => toast.error('Sync failed'));
  }

  function toggleDarkMode() {
    const newMode = !c.darkMode;
    c.setDarkMode(newMode);
    document.body.classList.toggle('dark-mode', newMode);
  }

  return (
    <div className="settings-tab">
      <h2>Settings</h2>
      <div>
        <input
          type="checkbox"
          id="setting-show-blurred-cover"
          checked={c.showBlurredCover}
          onChange={() => c.setShowBlurredCover(!c.showBlurredCover)}
        />
        <label htmlFor="setting-show-blurred-cover">Show blurred album cover as background in dark mode</label>
      </div>
      <button className="btn" onClick={toggleDarkMode}>
        <FontAwesomeIcon icon={c.darkMode ? faSun : faMoon} /> {c.darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      <button className="btn" onClick={rescanMusic}>
        <FontAwesomeIcon icon={faRotate} /> Rescan Music
      </button>
      <hr />
      <h2>Ongoing tasks</h2>
      <ProgressTable />
    </div>
  );
}

export default SettingsTab;
