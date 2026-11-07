import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "demo-evm",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
