declare global {
  interface Window {
    _native_fetchAPI?: (path: string, params?: Record<string, string>, method?: string) => Promise<any>;
    _native_fetchAPI_bridge?: {
      fetchAPI(path: string, params: string, method: string): string | null;
    };
  }
}

if (window._native_fetchAPI_bridge) {
  window._native_fetchAPI = async (path, params, method = "GET") => {
    const result = window._native_fetchAPI_bridge!.fetchAPI(
      path,
      params ? JSON.stringify(params) : "",
      method,
    );
    if (result === null) return null;
    return JSON.parse(result);
  };
}

const HOST = (() => {
  if (import.meta.env.DEV) {
    return "http://localhost:8000/api";
  }
  return `${location.origin}/api`;
})();

export function getTrackCoverFromId(id: string) {
  return `${HOST}/track/${id}/cover`;
}

export function getTrackFileFromId(id: string) {
  return `${HOST}/track/${id}/data`;
}

export function getFilePath(path: string) {
  return `${HOST}/file/${path}`;
}

export async function fetchAPI(
  path: string,
  params?: Record<string, string>,
  method: string = "GET",
) {
  if (!path.startsWith("/")) throw new Error(`"${path}" does not start with /`);

  const url = new URL(`${HOST}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  if (window._native_fetchAPI) {
    return window._native_fetchAPI(path, params, method);
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
