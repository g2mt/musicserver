export const HOST = (() => {
  if (import.meta.env.DEV) {
    return "http://localhost:8000/api";
  }
  return `${location.origin}/api`;
})();

export function fetchAPI(path: string, params?: Record<string, string>, method: string = "GET") {
}
