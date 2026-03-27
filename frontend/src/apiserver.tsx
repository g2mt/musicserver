export const HOST = (() => {
  if (import.meta.env.DEV) {
    return "http://localhost:8000/api";
  }
  return `${location.origin}/api`;
})();

export function fetchAPI(path: string, params?: Record<string, string>, method: string = "GET") {
  const url = new URL(path, HOST);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  return fetch(url.toString(), { method })
    .then((res) => {
      if (!res.ok) throw new Error(`API call failed: ${res.statusText}`);
      if (res.status === 204) return null; // No content
      return res.json();
    });
}
