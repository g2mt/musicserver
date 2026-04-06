import { useContext, useState } from "react";
import { rescanFiles } from "./apiserver";
import { toast } from "react-toastify";
import {
  faRotate,
  faMoon,
  faSun,
  faSave,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ProgressTable from "./ProgressTable";
import { AppContext, saveConfig } from "./AppState";

import "./SettingsTab.css";

export function SettingsTab() {
  const c = useContext(AppContext)!;
  const [unsaved, setUnsaved] = useState(false);

  return (
    <div className="settings-tab">
      <h2>Settings</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <div>
          <input
            type="checkbox"
            id="setting-show-blurred-cover"
            checked={c.showBlurredCover}
            onChange={() => {
              c.setShowBlurredCover(!c.showBlurredCover);
              setUnsaved(true);
            }}
          />
          <label htmlFor="setting-show-blurred-cover">
            Show blurred album cover as background in dark mode
          </label>
        </div>
        <div>
          <input
            type="checkbox"
            id="setting-show-only-queue-after-enqueue"
            checked={c.showOnlyQueueAfterEnqueue}
            onChange={() => {
              c.setShowOnlyQueueAfterEnqueue(!c.showOnlyQueueAfterEnqueue);
              setUnsaved(true);
            }}
          />
          <label htmlFor="setting-show-only-queue-after-enqueue">
            Show only queue after adding tracks
          </label>
        </div>
        <div>
          <label htmlFor="setting-search-history-limit">
            Search history limit
          </label>
          <input
            type="number"
            id="setting-search-history-limit"
            min={0}
            max={9999}
            value={c.searchHistoryLimit}
            onChange={(e) => {
              c.setSearchHistoryLimit(parseInt(e.target.value) || 0);
              setUnsaved(true);
            }}
          />
        </div>
        <p>
          <button
            className="btn"
            disabled={!unsaved}
            onClick={() => {
              saveConfig(c);
              setUnsaved(false);
              toast.success("Settings saved");
            }}
          >
            <FontAwesomeIcon icon={faSave} /> Save
          </button>
          <button
            className="btn"
            onClick={() => {
              c.setDarkMode((b) => !b);
              setUnsaved(true);
            }}
          >
            <FontAwesomeIcon icon={c.darkMode ? faSun : faMoon} />{" "}
            {c.darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </p>
        <p>
          <button
            className="btn"
            onClick={() => rescanFiles(false).then(() => c.onRescanned())}
          >
            <FontAwesomeIcon icon={faRotate} /> Rescan Music
          </button>
          <button
            className="btn"
            onClick={() => rescanFiles(true).then(() => c.onRescanned())}
          >
            <FontAwesomeIcon icon={faRotate} /> Rescan Music (force update)
          </button>
        </p>
      </form>
      <hr />

      <h2>Server properties</h2>
      {c.props && (
        <form>
          <div>
            <label>Version:</label>
            <input type="text" readOnly value={c.props.version} />
          </div>
          <div>
            <label>HTTP Bind:</label>
            <input type="text" readOnly value={c.props.config.http_bind} />
          </div>
          <div>
            <label>Unix Socket Enabled:</label>
            <input
              type="checkbox"
              readOnly
              checked={c.props.config.unix_bind_enabled}
            />
          </div>
          <div>
            <label>Unix Socket Path:</label>
            <input type="text" readOnly value={c.props.config.unix_bind} />
          </div>
          <div>
            <label>Data Path:</label>
            <input type="text" readOnly value={c.props.config.data_path} />
          </div>
          <div>
            <label>Database Directory:</label>
            <input type="text" readOnly value={c.props.config.db_dir} />
          </div>
          <div>
            <label>Cache database enabled:</label>
            <input
              type="checkbox"
              readOnly
              checked={c.props.config.cache_db_enabled}
            />
          </div>
          <div>
            <label>Media Downloader:</label>
            <input
              type="text"
              readOnly
              value={c.props.config.media_downloader}
            />
          </div>
        </form>
      )}
      {!import.meta.env.NO_PROGRESS_SUPPORT && (
        <>
          <hr />
          <h2>Ongoing processes</h2>
          <ProgressTable />
        </>
      )}
    </div>
  );
}
