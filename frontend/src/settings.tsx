declare global {
  interface NativeSettings {
    getItem(key: string): string;
    setItem(key: string, value: string): void;
  }
  interface Window {
    _native_settings?: NativeSettings;
  }
}

export const Settings = window._native_settings ?? localStorage;
