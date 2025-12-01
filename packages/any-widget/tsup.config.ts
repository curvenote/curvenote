import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'any-widget': 'src/directive/index.ts',
  },
  shims: true,
  splitting: false,
  sourcemap: false,
  clean: false, // Don't clean, we're building alongside tsc
  format: ['esm'],
  dts: false,
  outDir: 'dist/plugin',
  outExtension() {
    return {
      js: '.mjs',
    };
  },
});
