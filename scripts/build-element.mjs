import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// The <timelinr-slider> entry point is built separately from the main lib
// because it must be a SELF-CONTAINED single file: hosts load it with a bare
// `<script type="module">`, often straight off a static file server, and a
// relative import of a shared chunk would mean shipping (and serving) more
// than one file. Vite's lib mode with multiple entries emits exactly such a
// shared chunk, so this entry never goes through it — esbuild bundles the
// library classes right in, same pattern as scripts/build-examples.mjs.
await build({
  entryPoints: [resolve(root, 'src/element.ts')],
  outfile: resolve(root, 'dist/timelinr.element.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  logLevel: 'info',
});
