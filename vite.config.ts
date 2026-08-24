import { defineConfig, type Plugin } from 'vite';
import { build as esbuildBuild } from 'esbuild';
import { resolve } from 'node:path';

// Vite's ES lib builds hardcode `minifyWhitespace: false`, keeping all
// comments — this re-runs esbuild over the written chunk for a full pass.
// The chunk still carries Vite's sourceMappingURL comment, so esbuild merges
// the map (sources stay src/*.ts). Vite's printed size predates this hook.
function minifyEsLibOutput(): Plugin {
  return {
    name: 'minify-es-lib-output',
    apply: 'build',
    async closeBundle() {
      const out = resolve(__dirname, 'dist/timelinr.js');
      await esbuildBuild({
        entryPoints: [out],
        outfile: out,
        allowOverwrite: true,
        format: 'esm',
        target: 'es2022',
        minify: true,
        sourcemap: true,
        logLevel: 'silent',
      });
      const { statSync } = await import('node:fs');
      process.stdout.write(`dist/timelinr.js minified: ${(statSync(out).size / 1024).toFixed(2)} kB\n`);
    },
  };
}

export default defineConfig(({ command }) => {
  if (command === 'build') {
    // Library build: dist/timelinr.js (ESM)
    return {
      plugins: [minifyEsLibOutput()],
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          formats: ['es'],
          fileName: () => 'timelinr.js',
        },
        sourcemap: true,
        target: 'es2022',
      },
    };
  }
  // Dev server: serve examples as MPA
  return {
    server: { open: '/examples/index.html' },
  };
});
