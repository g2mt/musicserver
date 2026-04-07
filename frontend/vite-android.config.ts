import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { reactOptions } from './vite-common.config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(reactOptions), viteSingleFile()],
  build: { outDir: 'dist-android' },
  define: {
    'import.meta.env.NO_PROGRESS_SUPPORT': true,
  },
});
