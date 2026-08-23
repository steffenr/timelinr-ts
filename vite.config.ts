import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ command }) => {
  if (command === 'build') {
    // Library build: dist/timelinr.js (ESM)
    return {
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
