import React, { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder, faFile, faFolderOpen, faSearch } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { fetchAPI } from "./apiserver";
import { AppContext } from "./AppState";

import "./FileBrowserTab.css";

interface FileList {
  files: string[]|null;
  directories: string[]|null;
}

export default function FileBrowserTab() {
  const c = useContext(AppContext)!;
  const [path, setPath] = useState<string[]>([]);
  const [fileList, setFileList] = useState<FileList>({ files: [], directories: [] });

  useEffect(() => {
    const encodedPath = path.map(encodeURIComponent).join("/");
    fetchAPI(`/file/${encodedPath}`)
      .then((data) => setFileList(data))
      .catch((err) => {
        toast.error(`Failed to load directory: ${err.message}`);
        setFileList({ files: [], directories: [] });
      });
  }, [path]);

  const crumbs = path;

  return (
    <div className="file-browser-tab">
      <div className="file-browser-location-bar">
        <FontAwesomeIcon icon={faFolderOpen} />
        {" "}
        <a href="#" onClick={(e) => { e.preventDefault(); setPath([]); }}>root</a>
        {crumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {" / "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPath(path.slice(0, i + 1));
              }}
            >
              {crumb}
            </a>
          </React.Fragment>
        ))}
      </div>
      <table className="file-browser-table">
        <tbody>
          {path.length > 0 && (
            <tr>
              <td width={15}><FontAwesomeIcon icon={faFolder} /></td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); setPath(path.slice(0, -1)); }}>
                  ..
                </a>
              </td>
            </tr>
          )}
          {fileList.directories?.map((dir) => (
            <tr key={dir}>
              <td width={15}><FontAwesomeIcon icon={faFolder} /></td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); setPath([...path, dir]); }}>
                  {dir}
                </a>
              </td>
              <td width={15}>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  c.setSearchQuery(`path:"${[...path, dir].join("/")}"`);
                  c.showAllTracks();
                }}>
                  <FontAwesomeIcon icon={faSearch} />
                </a>
              </td>
            </tr>
          ))}
          {fileList.files?.map((file) => (
            <tr key={file}>
              <td><FontAwesomeIcon icon={faFile} /></td>
              <td>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  fetchAPI(`/track/:by-path/${path.map(encodeURIComponent).join("/")}/${encodeURIComponent(file)}`)
                    .then((data) => {
                      if (data.error) {
                        toast.error(data.error);
                      } else {
                        c.setCurrentTrack(data);
                      }
                    })
                    .catch((err) => toast.error(`Failed to load track: ${err.message}`));
                }}>
                  {file}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
