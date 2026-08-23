import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Minified copy of the library stylesheet for dist/. styles/timelinr.css
// itself stays unminified — it's the readable source consumers may want to
// read or override.
await build({
  entryPoints: { 'dist/timelinr': resolve(root, 'styles/timelinr.css') },
  outdir: root,
  bundle: true,
  minify: true,
  logLevel: 'info',
});
