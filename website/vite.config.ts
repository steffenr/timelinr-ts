import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// GitHub Pages serves the site from /timelinr-ts/. A custom domain can
// override the base through SITE_BASE without touching navigation code —
// all URLs in the app are relative or Vite-base-aware.
const base = process.env.SITE_BASE ?? '/timelinr-ts/';

export default defineConfig({
  base,
  resolve: {
    alias: {
      // The website always runs the library's local source, never a
      // published npm version — it doubles as a visual integration test.
      'timelinr-element': fileURLToPath(new URL('../src/element.ts', import.meta.url)),
    },
  },
});
