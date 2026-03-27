import { useEffect, useState } from "react";
import { fetchAPI, listenAPI } from "./apiserver";

interface ProgressEntry {
  value: number;
  max_value: number;
  output?: string;
}

type ProgressEvent =
  | {
      type: "Value" | "MaxValue";
      data: number;
    }
  | {
      type: "AddOutput";
      data: string;
    };

type ProgressEventWithSource = ProgressEvent & { source: string };

function ProgressTable() {
  const [progresses, setProgresses] = useState<Record<string, ProgressEntry>>(
    {},
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAPI("/progress")
      .then((data) => setProgresses(data ?? {}))
      .catch(() => {});
  }, []);

  useEffect(
    () =>
      listenAPI("/progress/:events", (data: ProgressEventWithSource) => {
        if (data.type === "AddOutput") {
          setProgresses((old) => {
            old[data.source].output =
              (old[data.source].output ?? "") + data.data;
            return old;
          });
        } else if (data.type === "Value" || data.type === "MaxValue") {
          setProgresses((old) => {
            old[data.source].value = data.data;
            return old;
          });
        }
      }),
    [progresses],
  );

  function toggleOutput(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function Row({ name, entry }: { name: string; entry: ProgressEntry }) {
    return (
      <>
        <tr title={`${entry.value}/${entry.max_value}`}>
          <td>{name}</td>
          <td>
            <progress value={entry.value} max={entry.max_value} />
          </td>
          <td>
            <button className="btn" onClick={() => toggleOutput(name)}>
              {expanded[name] ? "Hide" : "Show"}
            </button>
          </td>
        </tr>
        {expanded[name] && (
          <tr>
            <td colSpan={3}>
              <pre>{entry.output}</pre>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <table className="progress-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Progress</th>
          <th>Output</th>
        </tr>
      </thead>
      <tbody>
        {Object.keys(progresses).length > 0 ? (
          Object.entries(progresses).map(([name, entry]) => (
            <Row key={name} name={name} entry={entry} />
          ))
        ) : (
          <tr>
            <td colSpan={3}>No active processes.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default ProgressTable;
