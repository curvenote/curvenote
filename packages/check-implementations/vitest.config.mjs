import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    deps: {
      inline: ['myst-cli', 'myst-to-docx'],
    },
  },
});
