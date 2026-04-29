import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["development", "import", "module", "default"],
  },
  test: {
    env: {
      APP_CONFIG_ENV: "test",
    },
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["app/test-setup.ts"],
    fileParallelism: true,
  },
});
