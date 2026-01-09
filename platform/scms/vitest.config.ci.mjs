import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ...
    environment: 'node',
    globalSetup: './vitest.setup.ci.mjs',
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/prisma/**', '**/_build/**', '**/node_modules/**'],
    forceReruntriggers: ['app/**/*.{ts,tsx}'],
    testTimeout: 10000,
  },
});
