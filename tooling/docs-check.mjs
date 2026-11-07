#!/usr/bin/env node
/**
 * Documentation consistency check (dependency-free). Run: `pnpm docs:check` (or `node tooling/docs-check.mjs`).
 *
 * Checks the mechanical things that rot first. The rules are described in docs/README.md
 * ("What `pnpm docs:check` verifies"); keep that list and this file in sync.
 *
 * It cannot tell whether a sentence is still true: CLAUDE.md's documentation protocol covers that.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// DOCS_CHECK_ROOT lets the tests run the check against a fixture tree.
const ROOT = process.env.DOCS_CHECK_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".output",
  ".wxt",
  ".next",
  "target",
  "out",
  "cache",
  "coverage",
  "lib",
  ".claude",
]);
// Docs that quote legacy-repo paths on purpose; their backticked paths are not checked.
const SKIP_PATH_CHECK = new Set(["docs/migration/porting-plan.md"]);
// Local-only or generated paths that may legitimately be absent.
const IGNORED_PATH =
  /(^|\/)(dist|node_modules|target|\.output|coverage)(\/|$)|\.env(\.|$)|HANDOFF\.local\.md$/;
const REPO_PATH = /^(?:apps|packages|contracts|docs|tooling|\.github)\/[A-Za-z0-9_.@\-/]*$/;

/** @type {string[]} */
const errors = [];
/** @param {string} file @param {string} msg */
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
/** @param {string} p */
const rel = (p) => relative(ROOT, p).split("\\").join("/");
/** @param {string} p */
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/** @param {string} s */
const stripFences = (s) => s.replace(/^(\s*)(```|~~~)[\s\S]*?^\1\2[^\n]*$/gm, "");

/**
 * @param {string} dir
 * @param {(name: string) => boolean} pred
 * @param {string[]} [out]
 * @returns {string[]}
 */
function walk(dir, pred, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, pred, out);
    else if (pred(name)) out.push(p);
  }
  return out;
}
/** @param {string} p */
const listDirs = (p) =>
  existsSync(join(ROOT, p))
    ? readdirSync(join(ROOT, p)).filter((/** @type {string} */ n) =>
        statSync(join(ROOT, p, n)).isDirectory(),
      )
    : [];

const mdFiles = walk(ROOT, (n) => n.endsWith(".md")).map(rel);
const docFiles = mdFiles.filter((f) => f.startsWith("docs/"));
/** @param {string} f */
const isAdr = (f) => /^docs\/decisions\/\d{4}-.+\.md$/.test(f);

// 1. Every doc is listed in docs/README.md; every ADR in docs/decisions/README.md.
const docsIndex = read("docs/README.md");
for (const f of docFiles) {
  if (f === "docs/README.md" || isAdr(f)) continue;
  if (!docsIndex.includes(`\`${f}\``)) fail(f, "not listed in docs/README.md → All documents");
}
for (const m of docsIndex.matchAll(/^\|\s*`(docs\/[^`]+\.md)`/gm)) {
  const listed = m[1] ?? "";
  if (!existsSync(join(ROOT, listed)))
    fail("docs/README.md", `lists a doc that does not exist → ${listed}`);
}
const adrIndex = existsSync(join(ROOT, "docs/decisions/README.md"))
  ? read("docs/decisions/README.md")
  : "";
for (const f of docFiles.filter(isAdr)) {
  const name = f.slice("docs/decisions/".length);
  if (!adrIndex.includes(`(${name})`)) fail(f, "not listed in docs/decisions/README.md");
  if (!/^Status: /m.test(read(f))) fail(f, "ADR has no `Status:` line");
}

// 2. Header on every non-ADR doc.
for (const f of docFiles) {
  if (isAdr(f)) continue;
  const head = read(f).split("\n").slice(0, 12).join("\n");
  if (!/^Status: /m.test(head)) fail(f, "missing `Status:` line in the first lines");
  if (!/^Last verified: \d{4}-\d{2}-\d{2}/m.test(head))
    fail(f, "missing `Last verified: YYYY-MM-DD` line");
}

// Packages and apps declared in docs/architecture/packages.md (planned or real).
const packagesDoc = existsSync(join(ROOT, "docs/architecture/packages.md"))
  ? read("docs/architecture/packages.md")
  : "";
const declared = new Set(
  [...packagesDoc.matchAll(/`((?:apps|packages|contracts)\/[A-Za-z0-9_-]+)\/?`/g)].map((m) => m[1]),
);

// 3 + 4. Relative links and backticked repo paths.
for (const f of mdFiles) {
  const text = stripFences(read(f));
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const raw = m[1] ?? "";
    if (/^(https?:|mailto:|#|data:)/.test(raw)) continue;
    const target = raw.split("#")[0]?.split("?")[0];
    if (!target) continue;
    const abs = resolve(dirname(join(ROOT, f)), decodeURI(target));
    if (!existsSync(abs) && !IGNORED_PATH.test(rel(abs))) fail(f, `broken link → ${m[1]}`);
  }
  if (SKIP_PATH_CHECK.has(f)) continue;
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const token = (m[1] ?? "")
      .trim()
      .replace(/[:#]\d+(?:[-–]\d+)?$/, "")
      .replace(/[.,;]+$/, "");
    if (!REPO_PATH.test(token) || IGNORED_PATH.test(token)) continue;
    const clean = token.replace(/\/$/, "");
    const segs = clean.split("/");
    const top = segs[0];
    if (top === "docs" || top === "tooling" || top === ".github") {
      if (!existsSync(join(ROOT, clean))) fail(f, `path does not exist → ${token}`);
      continue;
    }
    const pkgRoot = segs.slice(0, 2).join("/");
    if (segs.length === 1) continue; // a top-level folder such as `packages/`
    if (segs.length <= 2) {
      if (!existsSync(join(ROOT, clean)) && !declared.has(clean)) {
        fail(f, `unknown app/package → ${token} (not in docs/architecture/packages.md)`);
      }
      continue;
    }
    // Deeper paths are checked once their package exists and the path names a file.
    if (
      existsSync(join(ROOT, pkgRoot)) &&
      /\.[a-z0-9]+$/i.test(clean) &&
      !existsSync(join(ROOT, clean))
    ) {
      fail(f, `path does not exist → ${token}`);
    }
  }
}

// 5. Every app/package directory has a README and is in packages.md.
for (const base of ["apps", "packages"]) {
  for (const d of listDirs(base)) {
    const p = `${base}/${d}`;
    if (!existsSync(join(ROOT, p, "README.md"))) fail(p, "has no README.md");
    if (!declared.has(p)) fail(p, "is not described in docs/architecture/packages.md");
  }
}

// 6. Every chain in the registry has a row in docs/chains/README.md.
const chainsDir = join(ROOT, "packages/chains/chains");
if (existsSync(chainsDir)) {
  const matrix = read("docs/chains/README.md");
  for (const n of readdirSync(chainsDir).filter((x) => x.endsWith(".json"))) {
    const id = JSON.parse(readFileSync(join(chainsDir, n), "utf8")).id;
    if (!id || !matrix.includes(`\`${id}\``))
      fail(`packages/chains/chains/${n}`, `chain ${id} has no row in docs/chains/README.md`);
  }
}

// 7. Every variable in any .env.example is documented.
const envDoc = existsSync(join(ROOT, "docs/operations/environments.md"))
  ? read("docs/operations/environments.md")
  : "";
const CHAIN_VAR =
  /^CHAIN_[A-Z0-9_]+?_(TRACE_RPC_URL|RPC_URL|HORIZON_URL|SPECULATIVE_URL|INDEXER_URL)$/;
for (const file of walk(ROOT, (n) => n === ".env.example").map(rel)) {
  for (const line of read(file).split("\n")) {
    const m = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})=/);
    const name = m?.[1];
    if (!name) continue;
    const generic = name.replace(CHAIN_VAR, "CHAIN_<SLUG>_$1");
    const prefixed = envDoc
      .match(/`([A-Z][A-Z0-9]*_)\*`/g)
      ?.some((t) => name.startsWith(t.slice(1, -2)));
    if (!envDoc.includes(`\`${name}\``) && !envDoc.includes(`\`${generic}\``) && !prefixed) {
      fail(file, `${name} is not documented in docs/operations/environments.md`);
    }
  }
}

if (errors.length) {
  console.error(`docs:check found ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(
    "\nFix the docs (or the code) and run `pnpm docs:check` again. Rules: docs/README.md.",
  );
  process.exit(1);
}
console.log(`docs:check passed (${mdFiles.length} Markdown files).`);
