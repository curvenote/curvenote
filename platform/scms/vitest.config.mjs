import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ...
    environment: 'node',
    globalSetup: './vitest.setup.mjs',
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/prisma/**'],
    forceReruntriggers: ['app/**/*.{ts,tsx}', 'tests/e2e/**/*.yml'],
  },
});
