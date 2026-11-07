import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "chains",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
