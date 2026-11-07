/**
 * Tests for the documentation and secret checks and the session doc-guard hook.
 * Each test builds a small scratch tree in the OS temp folder and runs the real script on it.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_CHECK = join(HERE, "docs-check.mjs");
const SECRETS_CHECK = join(HERE, "secrets-check.mjs");
const DOC_GUARD = join(HERE, "hooks", "doc-guard.mjs");
const IMPORT_RULES = join(HERE, "import-rules.mjs");

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "baret-tooling-"));
  scratch.push(root);
  write(root, files);
  return root;
}

function write(root: string, files: Record<string, string>): void {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}

function run(script: string, env: Record<string, string>, input = "") {
  const r = spawnSync(process.execPath, [script], {
    env: { ...process.env, ...env },
    input,
    encoding: "utf8",
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function git(root: string, ...args: string[]) {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
}

const header = "Status: **live**\nLast verified: 2026-01-01\n";
const validDocs = {
  "docs/README.md": `# Index\n\n${header}\n| \`docs/a.md\` | a |\n`,
  "docs/a.md": `# A\n\n${header}\nSee [index](README.md).\n`,
};

describe("docs-check", () => {
  const check = (root: string) => run(DOCS_CHECK, { DOCS_CHECK_ROOT: root });

  it("passes on the real repository", () => {
    const r = run(DOCS_CHECK, {});
    expect(r.out).toContain("docs:check passed");
    expect(r.status).toBe(0);
  });

  it("passes on a minimal valid tree", () => {
    expect(check(tree(validDocs)).status).toBe(0);
  });

  it("fails when a doc is not in the index", () => {
    const r = check(tree({ ...validDocs, "docs/b.md": `# B\n\n${header}` }));
    expect(r.status).toBe(1);
    expect(r.out).toContain("docs/b.md: not listed in docs/README.md");
  });

  it("fails when a doc has no Status / Last verified header", () => {
    const r = check(tree({ ...validDocs, "docs/a.md": "# A\n\nno header\n" }));
    expect(r.status).toBe(1);
    expect(r.out).toContain("missing `Status:`");
    expect(r.out).toContain("missing `Last verified:");
  });

  it("fails on a broken relative link and a missing docs path", () => {
    const r = check(
      tree({
        ...validDocs,
        "docs/a.md": `# A\n\n${header}\n[x](nope.md) and \`docs/missing.md\`\n`,
      }),
    );
    expect(r.out).toContain("broken link → nope.md");
    expect(r.out).toContain("path does not exist → docs/missing.md");
  });

  it("fails when a package has no README and is not in packages.md", () => {
    const r = check(tree({ ...validDocs, "packages/core/package.json": "{}" }));
    expect(r.out).toContain("packages/core: has no README.md");
    expect(r.out).toContain("packages/core: is not described in docs/architecture/packages.md");
  });

  it("requires every .env.example variable to be documented, accepting the CHAIN_<SLUG>_ form", () => {
    const env = {
      "docs/operations/environments.md": `# Env\n\n${header}\n| \`CHAIN_<SLUG>_RPC_URL\` | rpc |\n`,
      "docs/README.md": `# Index\n\n${header}\n| \`docs/a.md\` | a |\n| \`docs/operations/environments.md\` | env |\n`,
    };
    const ok = check(
      tree({ ...validDocs, ...env, "apps/api/.env.example": "CHAIN_MONAD_TESTNET_RPC_URL=\n" }),
    );
    expect(ok.out).not.toContain("CHAIN_MONAD_TESTNET_RPC_URL");
    const bad = check(tree({ ...validDocs, ...env, "apps/api/.env.example": "SECRET_THING=\n" }));
    expect(bad.out).toContain("SECRET_THING is not documented");
  });

  it("fails when an ADR is not listed in the ADR index", () => {
    const r = check(
      tree({
        ...validDocs,
        "docs/decisions/README.md": `# ADRs\n\n${header}`,
        "docs/decisions/0001-x.md": "# 0001\n\nStatus: Accepted\n",
        "docs/README.md": `# Index\n\n${header}\n| \`docs/a.md\` | a |\n| \`docs/decisions/README.md\` | adr |\n`,
      }),
    );
    expect(r.out).toContain("docs/decisions/0001-x.md: not listed in docs/decisions/README.md");
  });
});

describe("secrets-check", () => {
  const repo = (files: Record<string, string>) => {
    const root = tree(files);
    git(root, "init", "-q");
    return run(SECRETS_CHECK, { SECRETS_CHECK_ROOT: root });
  };
  const seed = `S${"A".repeat(55)}`;

  it("flags a Stellar secret seed and an assigned hex private key", () => {
    const r = repo({ "a.ts": `const s = "${seed}";\nPRIVATE_KEY=0x${"ab".repeat(32)}\n` });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Stellar secret seed");
    expect(r.out).toContain("private key assignment");
  });

  it("accepts a line marked `secret-scan: allow`", () => {
    expect(
      repo({ "a.ts": `const s = "${seed}"; // secret-scan: allow public test vector\n` }).status,
    ).toBe(0);
  });
});

describe("doc-guard hook", () => {
  const repo = () => {
    const root = tree(validDocs);
    git(root, "init", "-q");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "init");
    return root;
  };
  const hook = (root: string, input = "{}") => run(DOC_GUARD, { DOC_GUARD_ROOT: root }, input);

  it("asks for docs when code changed without docs", () => {
    const root = repo();
    write(root, { "packages/core/src/a.ts": "export {};\n" });
    const r = hook(root);
    expect(JSON.parse(r.out)).toMatchObject({ decision: "block" });
    expect(r.out).toContain("packages/core/src/a.ts");
  });

  it("never blocks twice in a row", () => {
    const root = repo();
    write(root, { "packages/core/src/a.ts": "export {};\n" });
    expect(hook(root, '{"stop_hook_active":true}').out).toBe("");
  });

  it("stays quiet when docs changed and pass the check", () => {
    const root = repo();
    write(root, { "docs/a.md": `# A\n\n${header}\nUpdated.\n` });
    expect(hook(root).out).toBe("");
  });

  it("hands back docs-check errors when the changed docs are broken", () => {
    const root = repo();
    write(root, { "docs/new.md": "# New\n" });
    const r = hook(root);
    expect(JSON.parse(r.out).reason).toContain("docs/new.md: not listed");
  });
});

describe("import-rules", () => {
  const check = (files: Record<string, string>) =>
    run(IMPORT_RULES, { IMPORT_RULES_ROOT: tree(files) });
  const src = (line: string) => [line, ""].join("\n");

  it("passes on the real repository", () => {
    expect(run(IMPORT_RULES, {}).out).toContain("imports:check passed");
  });

  it("allows an import its row permits", () => {
    const r = check({ "packages/chains/src/a.ts": src('import { x } from "@baret/core";') });
    expect(r.status).toBe(0);
  });

  it("refuses an @baret import the row does not permit", () => {
    const r = check({
      "packages/guard/src/a.ts": src('import { analyze } from "@baret/engine";'),
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("imports @baret/engine; packages/guard may import only core");
  });

  it("refuses a chain library outside its own adapter", () => {
    const r = check({
      "packages/core/src/a.ts": src('import { createPublicClient } from "viem";'),
      "apps/api/src/b.ts": src('const sdk = await import("@stellar/stellar-sdk");'),
      "packages/chain-evm/src/ok.ts": src('import { http } from "viem";'),
      "packages/chain-casper/src/bad.ts": src('import { x } from "viem/chains";'),
    });
    expect(r.out).toContain("packages/core/src/a.ts: imports chain library viem");
    expect(r.out).toContain("apps/api/src/b.ts: imports chain library @stellar/stellar-sdk");
    expect(r.out).toContain("packages/chain-casper/src/bad.ts: imports chain library viem");
    expect(r.out).not.toContain("chain-evm/src/ok.ts");
  });

  it("refuses a package that has no rule", () => {
    const r = check({ "packages/mystery/src/a.ts": src("export {};") });
    expect(r.out).toContain("packages/mystery: no import rule");
  });
});
