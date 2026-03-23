import { useEffect, useState } from 'react';
import { HOST } from './apiserver';
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
    const interval = setInterval(fetchProgress, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="settings-tab">
      <h2>Settings</h2>
      <hr />
      <h2>Progress</h2>
      <table className="progress-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(progresses).map(([name, entry]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>
                <progress value={entry.value} max={entry.max_value} />
              </td>
            </tr>
          ))}
          {Object.keys(progresses).length === 0 && (
            <tr><td colSpan={2}>No active processes.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default SettingsTab;
