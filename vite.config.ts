import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-chunk build: scripts/build-artifact.mjs then inlines it into one HTML page for claude.ai.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
