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
    // Several specs mock `@curvenote/scms-server` with `importOriginal()`,
    // which loads the whole server package inside a hook. That costs ~3s on a
    // warm dev machine and overran the 10s default on CI runners, where the
    // dead hook then surfaced as "vi.mocked(...).mockResolvedValue is not a
    // function" because the mock never got installed.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
