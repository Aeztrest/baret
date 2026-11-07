import { defineConfig } from "vitest/config";

/**
 * One runner for the whole workspace: every app and package is a project, plus the
 * repository tooling (docs and secret checks, session hooks).
 */
export default defineConfig({
  test: {
    projects: [
      "apps/*",
      "packages/*",
      { test: { name: "tooling", include: ["tooling/**/*.test.ts"], testTimeout: 30_000 } },
    ],
  },
});
