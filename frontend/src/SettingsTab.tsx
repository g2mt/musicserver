import { useEffect, useState } from 'react';
import { HOST } from './apiserver';
import { toast } from 'react-toastify';
import { faRotate } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './SettingsTab.css';

interface ProgressEntry {
  value: number;
  max_value: number;
}

function SettingsTab() {
  const [progresses, setProgresses] = useState<Record<string, ProgressEntry>>({});

  useEffect(() => {
    function fetchProgress() {
      fetch(`${HOST}/progress`)
        .then(res => res.json())
        .then(data => setProgresses(data ?? {}))
        .catch(() => {});
    }
    fetchProgress();
    const interval = setInterval(fetchProgress, 1000);
    return () => clearInterval(interval);
  }, []);

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
      <table className="progress-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {
            Object.keys(progresses).length > 0
            ? Object.entries(progresses).map(([name, entry]) => (
                <tr key={name}
                    title={`${entry.value}/${entry.max_value}`}>
                  <td>{name}</td>
                  <td>
                    <progress
                      value={entry.value} max={entry.max_value}/>
                  </td>
                </tr>
              ))
            : (
              <tr><td colSpan={2}>No active processes.</td></tr>
            )
          }
        </tbody>
      </table>
    </div>
  );
}

export default SettingsTab;
