export const HOST = (() => {
  if (import.meta.env.DEV) {
    return 'http://localhost:8000/api';
  }
  return `${location.origin}/api`;
})();
