import React, { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder, faFile, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { HOST } from "./apiserver";
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
    fetch(`${HOST}/file/${encodedPath}`)
      .then((res) => res.json())
      .then((data) => setFileList(data));
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
              <td><FontAwesomeIcon icon={faFolder} /></td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); setPath(path.slice(0, -1)); }}>
                  ..
                </a>
              </td>
            </tr>
          )}
          {fileList.directories?.map((dir) => (
            <tr key={dir}>
              <td><FontAwesomeIcon icon={faFolder} /></td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); setPath([...path, dir]); }}>
                  {dir}
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
                  fetch(`${HOST}/file/:by-path/${path.map(encodeURIComponent).join("/")}/${encodeURIComponent(file)}`)
                    .then((res) => res.json())
                    .then((data) => c.setCurrentTrack(data))
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
