import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    deps: {
      inline: ['myst-common', 'myst-config', 'myst-frontmatter', 'myst-migrate', 'myst-spec-ext'],
    },
  },
});

