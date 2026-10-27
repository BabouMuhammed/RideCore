import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    fileParallelism: false,
    hookTimeout: 180000,
    testTimeout: 30000,
    env: { NODE_ENV: "test" },
  },
});
