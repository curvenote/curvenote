import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  loader: {
    '.svg': 'dataurl', // Inlines SVGs as data URLs
  },
  external: [
    // Keep React and other peer deps external
    'react',
    'react-dom',
    'react-router',
    '@react-router/node',
    '@react-router/dev',
    '@react-router/express',
  ],
  // Ensure we preserve the .js extensions in imports
  outExtension: ({ format }) => ({
    js: '.js',
  }),
});
