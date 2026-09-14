import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // `build:server` runs `tsc` over the whole project, so `dist/` holds a
    // compiled copy of every spec. Turbo's `test` task depends on `build`, so
    // without this the suite would collect and run each spec twice — once from
    // source and once from the built JS, where the mock setup does not survive.
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
