import { useContext } from 'react';
import { HOST } from './apiserver';
import { toast } from 'react-toastify';
import { faRotate, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ProgressTable from './ProgressTable';
import { AppContext } from './AppState';
import './SettingsTab.css';

function SettingsTab() {
  const app = useContext(AppContext);

  function rescanMusic() {
    fetch(`${HOST}/track`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error();
        toast.success('Syncing complete');
      })
      .catch(() => toast.error('Sync failed'));
  }

  function toggleDarkMode() {
    const newMode = !app!.darkMode;
    app!.setDarkMode(newMode);
    document.body.classList.toggle('dark-mode', newMode);
  }

  return (
    <div className="settings-tab">
      <h2>Settings</h2>
      <button className="btn" onClick={toggleDarkMode}>
        <FontAwesomeIcon icon={app!.darkMode ? faSun : faMoon} /> {app!.darkMode ? 'Light Mode' : 'Dark Mode'}
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
