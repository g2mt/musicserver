import { useEffect, useState } from 'react';
import { HOST } from './apiserver';
import { toast } from 'react-toastify';
import { faRotate } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ProgressTable from './ProgressTable';
import './SettingsTab.css';

interface ProgressEntry {
  value: number;
  max_value: number;
}

function SettingsTab() {
  const [progresses, setProgresses] = useState<Record<string, ProgressEntry>>({});

  function rescanMusic() {
    fetch(`${HOST}/track`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error();
        toast.success('Syncing complete');
      })
      .catch(() => toast.error('Sync failed'));
  }

  return (
    <div className="settings-tab">
      <h2>Settings</h2>
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
