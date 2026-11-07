import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "chain-evm",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
