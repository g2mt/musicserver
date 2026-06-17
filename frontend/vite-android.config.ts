import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

import {reactOptions, resolveOptions} from './vite-common.config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(reactOptions), viteSingleFile()],
  build: {
    outDir: 'dist-android',
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
  define: {
    'import.meta.env.NO_PROGRESS_SUPPORT': true,
    'import.meta.env.USE_NATIVE_TOAST': true,
  },
  resolve: resolveOptions,
});
