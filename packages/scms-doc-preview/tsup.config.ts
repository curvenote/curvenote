import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  external: [
    '@curvenote/scms-core',
    '@curvenote/scms-server',
    '@curvenote/scms-db',
    '@curvenote/common',
    'pdfjs-dist',
    '@napi-rs/canvas',
    'officeparser',
    'sharp',
    'bmp-js',
    'p-limit',
    'zod',
  ],
  outExtension: ({ format }) => ({
    js: '.js',
  }),
});
