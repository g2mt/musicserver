import React, { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFile,
  faFolderOpen,
  faSearch,
  faReceipt,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import { fetchAPI, nativeScanTracks } from "./apiserver";
import { AppContext } from "./AppState";

import "./FileBrowserTab.css";

interface FileList {
  files: string[] | null;
  directories: string[] | null;
}

export default function FileBrowserTab() {
  const c = useContext(AppContext)!;
  const [fileList, setFileList] = useState<FileList>({
    files: [],
    directories: [],
  });

  useEffect(() => {
    const encodedPath = [c.props?.config.data_path ?? "", ...c.fbPath].map(encodeURIComponent).join("/");
    fetchAPI(`/file/${encodedPath}`)
      .then((data) => setFileList(data))
      .catch((err) => {
        toast.error(`Failed to load directory: ${err.message}`);
        setFileList({ files: [], directories: [] });
      });
  }, [c.fbPath]);

  return (
    <div className="file-browser-tab">
      <table className="file-browser-location-bar">
        <colgroup>
          <col style={{ width: "1px" }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: "60px" }} />
        </colgroup>
        <tbody>
          <tr>
            <td>
              <FontAwesomeIcon icon={faFolderOpen} />
            </td>
            <td>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  c.setFbPath([]);
                }}
              >
                root
              </a>
              {c.fbPath.map((crumb, i) => (
                <React.Fragment key={i}>
                  {" / "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      c.setFbPath(c.fbPath.slice(0, i + 1));
                    }}
                  >
                    {crumb}
                  </a>
                </React.Fragment>
              ))}
            </td>
            <td>
              <a
                href="#"
                title="Show tracks in this path"
                onClick={(e) => {
                  e.preventDefault();
                  c.setSearchQuery(`path:"${[...c.fbPath, dir].join("/")}"`);
                  c.setLeftTab("tracks");
                }}
              >
                <FontAwesomeIcon icon={faSearch} />
              </a>
              <a
                href="#"
                title="Scan only this path"
                onClick={(e) => {
                  e.preventDefault();
                  if (nativeScanTracks !== null) {
                    nativeScanTracks([...c.fbPath, dir].join("/"));
                  } else {
                    fetchAPI(
                      "/track",
                      { path: [...c.fbPath, dir].join("/") },
                      "POST",
                    )
                      .then(() => {
                        toast.success("Scanning complete");
                        c.onRescanned();
                      })
                      .catch(() => toast.error("Sync failed"));
                  }
                }}
              >
                <FontAwesomeIcon icon={faReceipt} />
              </a>
            
            </td>
          </tr>
        </tbody>
      </table>
      <table className="file-browser-table">
        <colgroup>
          <col style={{ width: "1px" }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: "60px" }} />
        </colgroup>
        <tbody>
          {c.fbPath.length > 0 && (
            <tr>
              <td>
                <FontAwesomeIcon icon={faFolder} />
              </td>
              <td>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    c.setFbPath(c.fbPath.slice(0, -1));
                  }}
                >
                  ..
                </a>
              </td>
            </tr>
          )}
          {fileList.directories?.map((dir) => (
            <tr key={dir}>
              <td>
                <FontAwesomeIcon icon={faFolder} />
              </td>
              <td>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    c.setFbPath([...c.fbPath, dir]);
                  }}
                >
                  {dir}
                </a>
              </td>
              <td>
                <a
                  href="#"
                  title="Show tracks in this path"
                  onClick={(e) => {
                    e.preventDefault();
                    c.setSearchQuery(`path:"${[...c.fbPath, dir].join("/")}"`);
                    c.setLeftTab("tracks");
                  }}
                >
                  <FontAwesomeIcon icon={faSearch} />
                </a>
                <a
                  href="#"
                  title="Scan only this path"
                  onClick={(e) => {
                    e.preventDefault();
                    if (nativeScanTracks !== null) {
                      nativeScanTracks([...c.fbPath, dir].join("/"));
                    } else {
                      fetchAPI(
                        "/track",
                        { path: [...c.fbPath, dir].join("/") },
                        "POST",
                      )
                        .then(() => {
                          toast.success("Scanning complete");
                          c.onRescanned();
                        })
                        .catch(() => toast.error("Sync failed"));
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faReceipt} />
                </a>
              </td>
            </tr>
          ))}
          {fileList.files?.map((file) => (
            <tr key={file}>
              <td width={15}>
                <FontAwesomeIcon icon={faFile} />
              </td>
              <td>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    fetchAPI(
                      `/track/:by-path/${c.fbPath.map(encodeURIComponent).join("/")}/${encodeURIComponent(file)}`,
                    )
                      .then((data) => {
                        if (data.error) {
                          toast.error(data.error);
                        } else {
                          c.setCurrentTrack(data);
                        }
                      })
                      .catch((err) =>
                        toast.error(`Failed to load track: ${err.message}`),
                      );
                  }}
                >
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
