import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    // Only bundle client code - server code uses tsc to preserve import.meta.url
    client: 'src/client.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: false, // Don't clean - tsc compiles server code, we only bundle client
  loader: {
    '.svg': 'dataurl', // Inlines SVGs as data URLs
    '.json': 'json', // Handles JSON imports (default, but explicit for clarity)
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
