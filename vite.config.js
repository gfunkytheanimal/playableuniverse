import { defineConfig } from 'vite';

// `base` is relative so the build works whether you serve from
// /playableuniverse/ on GitHub Pages or from the repo root locally.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'esnext' }
});
