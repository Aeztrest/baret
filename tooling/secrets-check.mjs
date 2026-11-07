#!/usr/bin/env node
/**
 * Secret scan over tracked and new (not ignored) files. Run: `pnpm secrets:check`.
 *
 * A line that must keep a key-shaped value on purpose (a public test vector, a documented
 * testnet demo key) carries the marker `secret-scan: allow <reason>` on the same line.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// SECRETS_CHECK_ROOT lets the tests scan a scratch repository.
const ROOT =
  process.env.SECRETS_CHECK_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** @type {Array<[string, RegExp]>} */
const PATTERNS = [
  [
    "private key assignment (hex)",
    /(PRIVATE_KEY|SECRET|MNEMONIC|SEED)[A-Z_]*\s*[=:]\s*["']?(0x)?[0-9a-fA-F]{64}\b/,
  ],
  ["Stellar secret seed", /\bS[A-Z2-7]{55}\b/],
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ["Anthropic/OpenAI-style key", /\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["npm token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Alchemy URL with key", /alchemy\.com\/v2\/[A-Za-z0-9_-]{20,}/],
  ["Baret API key", /\bbaret_(?:live|test)_[A-Za-z0-9]{20,}\b/],
];
const BINARY = /\.(png|jpe?g|webp|gif|ico|pdf|zip|wasm|woff2?|ttf|mp4|mov|xlsx)$/i;

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => !BINARY.test(f) && f !== "tooling/secrets-check.mjs");

/** @type {string[]} */
const hits = [];
for (const f of files) {
  let text;
  try {
    if (statSync(join(ROOT, f)).size > 2_000_000) continue;
    text = readFileSync(join(ROOT, f), "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (line.includes("secret-scan: allow")) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) hits.push(`${f}:${i + 1}  ${name}`);
  });
}

if (hits.length) {
  console.error(`secrets:check found ${hits.length} possible secret(s):\n`);
  for (const h of hits) console.error(`  ✗ ${h}`);
  console.error(
    "\nMove secrets to .env (gitignored). For a deliberate public value add `secret-scan: allow <reason>`.",
  );
  process.exit(1);
}
console.log(`secrets:check passed (${files.length} files scanned).`);
