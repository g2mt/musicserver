export const HOST = (() => {
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }
  return `${location.origin}/api`;
})();
