import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "web-ui",
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
