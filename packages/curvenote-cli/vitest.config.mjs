import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Disable threading to avoid cleanup issues with CommonJS dependencies  
    threads: false,
    server: {
      deps: {
        inline: ['@curvenote/check-implementations', 'myst-cli', 'myst-to-docx'],
      },
    },
  },
});
