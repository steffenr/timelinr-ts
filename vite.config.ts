import { defineConfig } from 'vite';

// Dev server only: serves examples/ as an MPA with live TS transform.
//
// There is no Vite library build anymore. The package's single public entry
// is the self-registering <timelinr-slider> bundle, which must ship as ONE
// self-contained file (hosts load it with a bare `<script type="module">`);
// that is built by scripts/build-element.mjs via esbuild. Vite's multi-entry
// lib mode was tried for this and rejected: Rollup extracts a shared chunk
// and turns every entry into a stub importing it.
export default defineConfig({
  server: { open: '/examples/index.html' },
});
