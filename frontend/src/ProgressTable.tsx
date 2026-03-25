import { useEffect, useState } from 'react';
import { HOST } from './apiserver';

interface ProgressEntry {
  value: number;
  max_value: number;
  output?: string;
}

interface ProgressTableProps {
  progresses: Record<string, ProgressEntry>;
}

type ProgressEvent =
  {
    type: "Value" | "MaxValue",
    data: number;
  }
  | {
    type: "AddOutput",
    data: string,
  };

function ProgressTable({ progresses }: ProgressTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [outputs, setOutputs] = useState<Record<string, string>>({});

  useEffect(() => {
    // Set up SSE for global progress events
    const es = new EventSource(`${HOST}/progress/:events`);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as ProgressEvent & { source?: string };
      const name = data.source;
      if (!name) return;

      if (data.type === 'AddOutput') {
        setOutputs(prev => ({
          ...prev,
          [name]: (prev[name] || '') + data.data
        }));
      } else if (data.type === 'Value' || data.type === 'MaxValue') {
        // Force re-render by updating state
        setOutputs(prev => ({ ...prev }));
      }
    };

    return () => {
      es.close();
    };
  }, [progresses]);

  function toggleOutput(name: string) {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
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
                <td>
                  <button onClick={() => toggleOutput(name)}>
                    {expanded[name] ? 'Hide' : 'Show'}
                  </button>
                  {expanded[name] && (
                    <pre>{outputs[name] || ''}</pre>
                  )}
                </td>
              </tr>
            ))
          : (
            <tr><td colSpan={3}>No active processes.</td></tr>
          )
        }
      </tbody>
    </table>
  );
}

export default ProgressTable;
