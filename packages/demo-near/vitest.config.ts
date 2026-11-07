import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "demo-near",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
