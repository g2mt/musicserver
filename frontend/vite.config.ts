import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactOptions, resolveOptions } from './vite-common.config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(reactOptions)],
  resolve: resolveOptions,
});
