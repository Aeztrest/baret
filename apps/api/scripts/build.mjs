#!/usr/bin/env node
/**
 * Builds dist/main.js for production (Render runs `node dist/main.js`, not tsx).
 *
 * Only this app's own npm dependencies (package.json `dependencies`) stay external and are
 * loaded from node_modules at runtime. Everything else is bundled: the @baret workspace
 * packages (TypeScript source) and whatever they import (viem, zod, …). With pnpm's strict
 * node_modules a package this app does not list could not be resolved at runtime, so it
 * must not be left external (found by the first smoke run).
 */
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = new Set(
  Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@baret/")),
);
const packageOf = (path) =>
  path.startsWith("@") ? path.split("/").slice(0, 2).join("/") : path.split("/")[0];

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
  // Bundled CommonJS code may call require(); give it one in the ESM output.
  banner: {
    js: "import { createRequire as __baretRequire } from 'node:module'; const require = __baretRequire(import.meta.url);",
  },
  plugins: [
    {
      name: "external-own-deps",
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          external.has(packageOf(args.path)) ? { path: args.path, external: true } : undefined,
        );
      },
    },
  ],
});
