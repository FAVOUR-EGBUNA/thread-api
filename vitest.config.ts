import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({
  path: ".env.test",
  override: true,
});

if (process.env.NODE_ENV !== "test") {
  throw new Error("Automated tests must run with NODE_ENV=test.");
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required for automated tests.");
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],

    // Integration tests share one remote Neon test database.
    // Run test files sequentially so their setup/cleanup operations
    // cannot interfere with one another.
    fileParallelism: false,

    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
