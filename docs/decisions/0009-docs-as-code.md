# 0009 — Docs as code, enforced by CI and a session hook

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner asked for docs that keep themselves current)

## Context
Legacy repos drifted: Metropolis listed "named in documents, never built" and "documents that describe an older state" as gaps (G-13, G-21). Baret-Stellar's `docs:check` script and code ↔ doc table worked well.

## Decision
- `CLAUDE.md` documentation protocol: a task is not done until its docs are true; docs change in the same commit as code.
- `docs/README.md` owns the code ↔ doc map and the doc rules; every doc has `Status:` and `Last verified:`.
- `tooling/docs-check.mjs` (CI, blocking) checks the mechanical parts; `tooling/secrets-check.mjs` checks for secrets.
- `.claude/settings.json` runs `tooling/hooks/doc-guard.mjs` when a Claude session stops: if code changed without any doc or `TASKS.md` change, the session is asked once to update them.
- `TASKS.md` is the single task list.

## Consequences
Slightly slower PRs; docs that agents and investors can trust. The checks cannot verify meaning, so review still matters.
