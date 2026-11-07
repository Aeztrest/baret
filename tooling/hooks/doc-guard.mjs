#!/usr/bin/env node
/**
 * Claude Code Stop hook (registered in .claude/settings.json). Enforces the documentation
 * protocol in CLAUDE.md at the end of a session turn:
 *
 *   1. Code changed in the working tree but no doc / TASKS.md changed → ask the agent to
 *      update the docs (once; `stop_hook_active` prevents a loop).
 *   2. Docs changed → run docs-check; if it fails, hand the errors back to the agent (once).
 *
 * It never blocks twice in a row and never fails the session on its own errors.
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// DOC_GUARD_ROOT lets the tests run the hook against a scratch repository.
const ROOT =
  process.env.DOC_GUARD_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {{ stop_hook_active?: boolean }} */
let input = {};
try {
  /** @type {string} */
  const raw = await new Promise((res) => {
    let s = "";
    process.stdin.on("data", (c) => (s += c));
    process.stdin.on("end", () => res(s));
    setTimeout(() => res(s), 2000);
  });
  input = raw ? JSON.parse(raw) : {};
} catch {
  input = {};
}
if (input.stop_hook_active) process.exit(0);

/** @param {string[]} args */
const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
/** @type {string[]} */
let changed = [];
try {
  changed = git(["status", "--porcelain", "--untracked-files=all"])
    .split("\n")
    .filter(Boolean)
    .map((l) =>
      l
        .slice(3)
        .replace(/^.* -> /, "")
        .trim(),
    );
} catch {
  process.exit(0);
}
if (changed.length === 0) process.exit(0);

/** @param {string} p */
const isCode = (p) =>
  /^(apps|packages|contracts|tooling|\.github)\//.test(p) ||
  /(^|\/)(render\.yaml|vercel\.json|package\.json|pnpm-workspace\.yaml|\.env\.example)$/.test(p);
/** @param {string} p */
const isDoc = (p) => p.startsWith("docs/") || p.endsWith(".md");

const code = changed.filter((p) => isCode(p) && !p.endsWith(".md"));
const docs = changed.filter(isDoc);

/** @param {string} reason */
const block = (reason) => {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
};

if (code.length > 0 && docs.length === 0) {
  block(
    `Documentation protocol (CLAUDE.md): code changed (${code.slice(0, 8).join(", ")}${code.length > 8 ? ", …" : ""}) ` +
      "but no doc or TASKS.md changed. Look up these paths in docs/README.md → 'Code ↔ doc map', update the listed docs " +
      "and TASKS.md, then run `node tooling/docs-check.mjs`. If no doc needs to change, say why in your final message.",
  );
}

if (docs.length > 0) {
  try {
    const checker = resolve(dirname(fileURLToPath(import.meta.url)), "../docs-check.mjs");
    execFileSync(process.execPath, [checker], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, DOCS_CHECK_ROOT: ROOT },
    });
  } catch (e) {
    const err = /** @type {{ stdout?: string, stderr?: string }} */ (e);
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim().split("\n").slice(0, 30).join("\n");
    block(`docs-check failed after your doc changes. Fix these before finishing:\n${out}`);
  }
}
process.exit(0);
