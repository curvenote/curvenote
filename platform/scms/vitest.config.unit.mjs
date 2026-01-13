import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert `import.meta.url` to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    // ...
    plugins: [tsconfigPaths({})],
    environment: 'node',
    include: ['**/(tests|app)/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: [
      '**/prisma/**',
      `tests/e2e/**/*`,
      `tests/integration/**/*`,
      `**/_build/**/*`,
      '**/node_modules/**',
    ],
    forceReruntriggers: ['app/**/*.{ts,tsx}'],
    alias: {
      '~': path.resolve(__dirname, './app/'),
    },
  },
});
