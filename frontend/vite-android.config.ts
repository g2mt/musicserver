import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-android' },
  define: {
    'import.meta.env.VITE_NO_PROGRESS_SUPPORT': true,
  },
});
