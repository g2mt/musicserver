const HOST = (() => {
  if (import.meta.env.DEV) {
    return "http://localhost:8000/api";
  }
  return `${location.origin}/api`;
})();

declare global {
  interface Native {
    fetchAPI: (path: string, method: string, params: string) => string | null;
    scanTracks: (path: string) => void;
  }
  interface Window {
    _native?: Native;
  }
}

export function getTrackCoverFromPath(path: string) {
  return `track-cover://${path}`;
}

export function getTrackCoverFromId(id: string) {
  return `${HOST}/track/${id}/cover`;
}

export function getTrackFileFromId(id: string) {
  return `${HOST}/track/${id}/data`;
}

export function getFilePath(path: string) {
  return `${HOST}/file/${path}`;
}

export function fetchAPI(
  path: string,
  params?: Record<string, string>,
  method: string = "GET",
): Promise<any> {
  if (!path.startsWith("/")) throw new Error(`"${path}" does not start with /`);

  if (window._native) {
    const result = window._native.fetchAPI(
      path,
      method,
      JSON.stringify(params ?? {}),
    );
    return new Promise((res, rej) => {
      try {
        res(result === null ? null : JSON.parse(result));
      } catch (e) {
        rej(e);
      }
    });
  }

  const url = new URL(`${HOST}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  return fetch(url.toString(), { method }).then((res) => {
    if (!res.ok) throw new Error(`API call failed: ${res.statusText}`);
    return res.json();
  });
}

export function listenAPI(
  path: string,
  onMessage: (data: any) => void,
): () => void {
  if (!path.startsWith("/")) throw new Error(`"${path}" does not start with /`);

  const es = new EventSource(`${HOST}${path}`);
  es.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  return () => es.close();
}

// Bind to prevent "Java bridge method can't be invoked on a non-injected object" error
export const nativeScanTracks = (() =>
  typeof window._native !== "undefined"
    ? window._native.scanTracks.bind(window._native)
    : null)();
