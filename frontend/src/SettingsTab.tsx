import { useContext, useState } from "react";
import { fetchAPI } from "./apiserver";
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

  const handleSave = () => {
    saveConfig(c);
    setUnsaved(false);
    toast.success("Settings saved");
  };

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
      <button className="btn" disabled={!unsaved} onClick={handleSave}>
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
          fetchAPI("/track", undefined, "POST")
            .then(() => {
              toast.success("Scanning complete");
              c.onRescanned();
            })
            .catch(() => toast.error("Sync failed"));
        }}
      >
        <FontAwesomeIcon icon={faRotate} /> Rescan Music
      </button>
      <hr />

      <h2>Server properties</h2>
      <hr />

      <h2>Ongoing processes</h2>
      <ProgressTable />
    </div>
  );
}

export default SettingsTab;
