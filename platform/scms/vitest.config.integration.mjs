import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert `import.meta.url` to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    plugins: [tsconfigPaths({})],
    environment: 'node',
    include: ['app/**/*.spec.ts', 'tests/integration/**/*.spec.ts', '!**/_build/**'],
    exclude: ['**/prisma/**', 'tests/e2e/**/*', '**/_build/**', '**/node_modules/**'],
    forceReruntriggers: ['app/**/*.{ts,tsx}'],
    alias: {
      '~': path.resolve(__dirname, './app/'),
      '@': path.resolve(__dirname, './'),
    },
  },
});
