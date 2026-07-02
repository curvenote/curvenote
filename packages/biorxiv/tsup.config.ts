import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    client: 'src/client.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: false,
  loader: {
    '.svg': 'dataurl',
  },
  external: ['react', 'react-dom', 'react-router'],
  outExtension: () => ({
    js: '.js',
  }),
});
