import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    // Keep dependencies that should remain external
    'react',
    'react-dom',
    'react-router',
    '@react-router/node',
    '@react-router/dev',
    '@react-router/express',
    '@curvenote/scms-core', // Don't bundle our own package
  ],
  // Ensure we preserve the .js extensions in imports
  outExtension: ({ format }) => ({
    js: '.js',
  }),
});
