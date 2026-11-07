#!/usr/bin/env node
/**
 * Import rules (ADR-0003). Run: `pnpm imports:check`. Runs in CI.
 *
 * 1. A package may import only the @baret packages its row allows.
 * 2. Chain libraries (viem, @stellar/stellar-sdk, casper-js-sdk, …) may be imported only by
 *    the chain adapter of their own family.
 * 3. A package or app missing from RULES fails: add its row here and in
 *    docs/architecture/packages.md §4 in the same PR.
 *
 * RULES below is the machine copy of docs/architecture/packages.md §4; change both together.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// IMPORT_RULES_ROOT lets the tests run the check against a fixture tree.
const ROOT =
  process.env.IMPORT_RULES_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CHAIN_ADAPTERS = ["chain-evm", "chain-stellar", "chain-casper"];

/** @type {Record<string, string[]>} workspace dir → @baret packages it may import */
const RULES = {
  "packages/core": [],
  "packages/chains": ["core"],
  "packages/chain-evm": ["core", "chains"],
  "packages/chain-stellar": ["core", "chains"],
  "packages/chain-casper": ["core", "chains"],
  "packages/providers": ["core"],
  "packages/engine": ["core", "chains", "providers", ...CHAIN_ADAPTERS],
  "packages/guard": ["core"],
  "packages/agent-kit": ["core", "guard", "chains", ...CHAIN_ADAPTERS],
  "packages/wallet-core": ["core", "guard", "chains", ...CHAIN_ADAPTERS],
  "packages/content": ["core"],
  "packages/ui": ["content"],
  "packages/web-ui": ["content", "ui"],
  "apps/api": ["engine", "providers", "chains", "core", "content"],
  "apps/extension": ["wallet-core", "guard", "ui", "content", "chains", "core"],
  "apps/web": ["guard", "ui", "web-ui", "content", "chains", "core", "wallet-core"],
};

/** @type {Record<string, string[]>} family adapter → the chain libraries only it may import */
const CHAIN_LIBRARIES = {
  "chain-evm": ["viem", "ethers", "@ethersproject"],
  "chain-stellar": ["@stellar/stellar-sdk", "@stellar/stellar-base", "@stellar/freighter-api"],
  "chain-casper": ["casper-js-sdk", "@make-software/csprclick-core-client"],
};

const SKIP_DIRS = new Set(["node_modules", "dist", "dist-types", ".output", ".wxt", "coverage"]);
const SOURCE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs)$/;
// import … from "x" · export … from "x" · import("x") · import "x" · require("x")
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"'\n]+)["']/g;

/** @type {string[]} */
const errors = [];

/** @param {string} dir @param {string[]} [out] @returns {string[]} */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE.test(name)) out.push(p);
  }
  return out;
}

/** @param {string} spec @returns {string | null} the package name of a bare specifier */
function packageName(spec) {
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) return null;
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? null);
}

for (const base of ["apps", "packages"]) {
  const baseDir = join(ROOT, base);
  if (!existsSync(baseDir)) continue;
  for (const name of readdirSync(baseDir)) {
    const dir = `${base}/${name}`;
    if (!statSync(join(ROOT, dir)).isDirectory()) continue;
    const allowed = RULES[dir];
    if (!allowed) {
      errors.push(
        `${dir}: no import rule. Add it to tooling/import-rules.mjs and docs/architecture/packages.md §4.`,
      );
      continue;
    }
    const self = name;
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file).split("\\").join("/");
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(SPECIFIER)) {
        const pkg = packageName(m[1] ?? "");
        if (!pkg) continue;
        if (pkg.startsWith("@baret/")) {
          const target = pkg.slice("@baret/".length);
          if (target !== self && !allowed.includes(target)) {
            errors.push(
              `${rel}: imports ${pkg}; ${dir} may import only ${allowed.join(", ") || "no @baret package"}`,
            );
          }
          continue;
        }
        for (const [owner, libs] of Object.entries(CHAIN_LIBRARIES)) {
          if (owner !== self && libs.some((lib) => pkg === lib || pkg.startsWith(`${lib}/`))) {
            errors.push(
              `${rel}: imports chain library ${pkg}; only packages/${owner} may (ADR-0003)`,
            );
          }
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`imports:check found ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(
    "\nRules: docs/architecture/packages.md §4 (machine copy in tooling/import-rules.mjs).",
  );
  process.exit(1);
}
console.log("imports:check passed.");
