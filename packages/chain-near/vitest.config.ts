import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "chain-near",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
