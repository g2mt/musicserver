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
import { fetchAPI, rescanFiles } from "./apiServer";
import { AppContext } from "./AppState";

import "./FileBrowserTab.css";

interface FileList {
  files: string[] | null;
  directories: string[] | null;
}

interface DirectoryRowProps {
  path: string[];
  isLocationBar?: boolean;
}

function DirectoryRow({ path, isLocationBar = false }: DirectoryRowProps) {
  const c = useContext(AppContext)!;

  const sideIcons = (
    <td>
      <a
        href="#"
        title="Show tracks in this path"
        onClick={(e) => {
          e.preventDefault();
          c.setSearchQuery(`path:"${path.join("/")}"`);
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
          rescanFiles(false, path.join("/"));
        }}
      >
        <FontAwesomeIcon icon={faReceipt} />
      </a>
    </td>
  );

  if (isLocationBar) {
    return (
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
          {path.map((crumb, i) => (
            <React.Fragment key={i}>
              {" / "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  c.setFbPath(path.slice(0, i + 1));
                }}
              >
                {crumb}
              </a>
            </React.Fragment>
          ))}
        </td>
        {sideIcons}
      </tr>
    );
  }

  const dirName = path[path.length - 1];

  return (
    <tr>
      <td>
        <FontAwesomeIcon icon={faFolder} />
      </td>
      <td>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            c.setFbPath(path);
          }}
        >
          {dirName}
        </a>
      </td>
      {sideIcons}
    </tr>
  );
}

interface FileRowProps {
  fileName: string;
  dirPath: string[];
}

function FileRow({ fileName, dirPath }: FileRowProps) {
  const c = useContext(AppContext)!;

  return (
    <tr>
      <td width={15}>
        <FontAwesomeIcon icon={faFile} />
      </td>
      <td>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            fetchAPI(
              `/track/:by-path/${dirPath.map(encodeURIComponent).join("/")}/${encodeURIComponent(fileName)}`,
            )
              .then((data) => {
                if (data.error) {
                  toast.error(data.error);
                } else {
                  c.as.setCurrentTrack(data);
                }
              })
              .catch((err) =>
                toast.error(`Failed to load track: ${err.message}`),
              );
          }}
        >
          {fileName}
        </a>
      </td>
    </tr>
  );
}

export default function FileBrowserTab() {
  const c = useContext(AppContext)!;
  const [fileList, setFileList] = useState<FileList>({
    files: [],
    directories: [],
  });

  useEffect(() => {
    const encodedPath = [c.props?.config.data_path ?? "", ...c.fbPath]
      .map(encodeURIComponent)
      .join("/");
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
          <col style={{ width: "25px" }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: "60px" }} />
        </colgroup>
        <tbody>
          <DirectoryRow path={c.fbPath} isLocationBar={true} />
        </tbody>
      </table>
      <table className="file-browser-table">
        <colgroup>
          <col style={{ width: "25px" }} />
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
            <DirectoryRow key={dir} path={[...c.fbPath, dir]} />
          ))}
          {fileList.files?.map((file) => (
            <FileRow key={file} fileName={file} dirPath={c.fbPath} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
