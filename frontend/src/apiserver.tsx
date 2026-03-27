export const HOST = (() => {
  if (import.meta.env.DEV) {
    return "http://localhost:8000/api";
  }
  return `${location.origin}/api`;
})();

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

  return fetch(url.toString(), { method }).then((res) => {
    if (!res.ok) throw new Error(`API call failed: ${res.statusText}`);
    return res.json();
  });
}
