import { useContext, useState, useEffect } from "react";
import { fetchAPI, nativeScanTracks } from "./apiserver";
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

function SettingsTab() {
  const c = useContext(AppContext)!;
  const [unsaved, setUnsaved] = useState(false);
  const [props, setProps] = useState<{ version: string; config: any } | null>(null);

  useEffect(() => {
    fetchAPI("/props").then(setProps).catch(() => {});
  }, []);

  return (
    <div className="settings-tab">
      <h2>Settings</h2>
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
      <button className="btn" disabled={!unsaved} onClick={() => {
        saveConfig(c);
        setUnsaved(false);
        toast.success("Settings saved");
      }}>
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
      <button
        className="btn"
        onClick={() => {
          if (nativeScanTracks) {
            nativeScanTracks();
          } else {
            fetchAPI("/track", undefined, "POST")
              .then(() => {
                toast.success("Scanning complete");
                c.onRescanned();
              })
              .catch(() => toast.error("Sync failed"));
          }
        }}
      >
        <FontAwesomeIcon icon={faRotate} /> Rescan Music
      </button>
      <hr />

      <h2>Server properties</h2>
      {props && (
        <form>
          <div>
            <label>Version:</label>
            <input type="text" readOnly value={props.version} />
          </div>
          <div>
            <label>HTTP Bind:</label>
            <input type="text" readOnly value={props.config.http_bind} />
          </div>
          <div>
            <label>Unix Socket Enabled:</label>
            <input type="checkbox" readOnly checked={props.config.unix_bind_enabled} />
          </div>
          <div>
            <label>Unix Socket Path:</label>
            <input type="text" readOnly value={props.config.unix_bind} />
          </div>
          <div>
            <label>Data Path:</label>
            <input type="text" readOnly value={props.config.data_path} />
          </div>
          <div>
            <label>Database Directory:</label>
            <input type="text" readOnly value={props.config.db_dir} />
          </div>
          <div>
            <label>Media Downloader:</label>
            <input type="text" readOnly value={props.config.media_downloader} />
          </div>
        </form>
      )}
      <hr />

      <h2>Ongoing processes</h2>
      <ProgressTable />
    </div>
  );
}

export default SettingsTab;
