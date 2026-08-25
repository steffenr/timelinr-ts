import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const at = (p) => resolve(root, p);

// Bundles each example's main.ts (plus the library itself, its only import)
// into one self-contained, minified, non-module script per page — no .ts
// served, no dev server or bare-import resolution required to run
// examples/*. The DOM the scripts operate on is static markup already in
// each example's index.html, not built by these scripts.
await build({
  entryPoints: {
    'examples/rail/main': at('examples/rail/main.ts'),
    'examples/stack/main': at('examples/stack/main.ts'),
    'examples/tabs/main': at('examples/tabs/main.ts'),
    'examples/list/main': at('examples/list/main.ts'),
    'examples/list-alternating/main': at('examples/list-alternating/main.ts'),
    'examples/autoplay/main': at('examples/autoplay/main.ts'),
    'examples/fixed-header/main': at('examples/fixed-header/main.ts'),
    'examples/auto-size/main': at('examples/auto-size/main.ts'),
  },
  outdir: root,
  bundle: true,
  minify: true,
  // EVERY example imports src/element.ts as a bare side effect
  // (self-registering <timelinr-slider>), and the package.json
  // "sideEffects" allowlist names only dist/timelinr.element.js — esbuild
  // applies that list to this repo too and would strip the import,
  // silently unregistering the element on every example page.
  treeShaking: false,
  format: 'iife',
  target: 'es2022',
  logLevel: 'info',
});

// Minified copies of the CSS the examples link to. styles/timelinr.css
// itself stays unminified — it's the published, human-readable source
// consumers may want to read or override.
await build({
  entryPoints: {
    'examples/assets/timelinr.min': at('styles/timelinr.css'),
    'examples/assets/style.min': at('examples/shared/style.css'),
  },
  outdir: root,
  bundle: true,
  minify: true,
  logLevel: 'info',
});
