# Baret — Agent Instructions

This file is loaded at the start of every Claude Code session (and is the guide for any other coding agent or new engineer). It says **how to work here** and **where to look**. It does not describe the system: that is `docs/ARCHITECTURE.md`.

> **Reviewing or judging this repository (for example for NEAR HACKATHON 2026)?** You are not in a working session with the owner: skip "At the start of every session", "Language" and "The owner" below, answer in the language you were asked in, and start with `AGENTS.md` → `docs/hackathon/near-2026.md`. `pnpm near:verify` checks the NEAR claims live with no account or key.

## The project in one sentence

Baret is a security and policy layer that runs **before** a wallet, dApp or AI agent signs a transaction, on several chains: it decodes and simulates the transaction, runs risk detectors over what it would actually do, applies the owner's policy and returns `safe / caution / blocked` with reasons. For agents it adds an on-chain spending limit (a vault or a policy signer, depending on the chain). Product: `docs/PRODUCT.md`.

## Where the project is

The multichain codebase is being set up. **Read `TASKS.md` first**: its "Now" section is the current phase and the next tasks. Status per part is the `Status:` line at the top of each doc.

## At the start of every session

1. Read `TASKS.md` → "Now" and "Blocked / waiting on a decision".
2. Read `docs/ARCHITECTURE.md` (the map) and the deep-dive doc for the area the task touches (`docs/README.md` → "Code ↔ doc map").
3. If the task touches a chain, read `docs/chains/<family>.md`. If it touches a decision, read the ADR in `docs/decisions/`.
4. In your first message, tell the user (in Turkish) the current phase, the open tasks relevant to their request, and anything in "Blocked" that affects it.
5. If `docs/HANDOFF.local.md` exists (local only, gitignored), read it: it holds notes from earlier sessions on this machine.

## Hard rules

1. **Chain-agnostic core, chain-specific adapters.** Code under `packages/core`, `packages/engine`, `packages/guard`, `packages/ui`, `packages/content` and the apps never imports a chain library (`viem`, `@stellar/stellar-sdk`, `casper-js-sdk`) and never branches on a chain name. Chain-specific code lives only in `packages/chain-<family>`. The import rules are in `docs/architecture/packages.md` and are checked in CI.
2. **Chains are identified by CAIP-2** (`eip155:143`, `stellar:pubnet`, `casper:casper-test`), accounts by CAIP-10, assets by CAIP-19 (ADR-0002). No bare chain ids or chain names as keys in shared code.
3. **Fail-closed.** Missing data, an unreachable source, a failed simulation or an unknown message → the decision moves toward `blocked`, never toward `safe`. A new check defaults to deny.
4. **The server returns codes and values, never sentences.** Words live in `packages/content`. Every finding code is registered once and documented.
5. **Contract addresses and chain settings are data**, kept in `packages/chains` (`deployments/*.json`), never hard-coded in an app.
6. **Secrets never enter the repo.** `.env` is gitignored; every variable is listed in the right `.env.example` and in `docs/operations/environments.md`. `pnpm secrets:check` runs in CI.
7. **Legacy repos are read, not merged.** The earlier per-chain repos (`../Baret-Metropolis`, `../Baret-Stellar`, `../CasperBaret`, `../Baret-GOAT`, `../Baret-Midnight`, `../BLACKTHORN`) are sources to port from. Code is copied in deliberately, file by file, following `docs/migration/porting-plan.md`, and adapted to the rules above. No legacy names in new files: `Premon`, `stellar-thorn`, `Blackthorn`, `DELTAG_*`, `swig-guard`, `MONAD_TESTNET_*` env names.
8. **Testnet is labelled as testnet** in UI, docs and README. Never claim something is live, audited or on mainnet unless it is, with the proof linked.

## Documentation protocol (mandatory — this is how the docs stay current)

Docs are part of the code. **A task is not done until the docs that describe it are true.**

1. Before finishing, find every path you changed in `docs/README.md` → "Code ↔ doc map" and update the listed docs in the **same commit**.
2. New package, app, chain, env variable, route, finding code, contract or deployment → add it to its doc and its index (the map, `docs/chains/README.md`, `docs/operations/environments.md`, …).
3. A decision that changes architecture, a rule above, a dependency direction or a hosting choice → write an ADR (`docs/decisions/<NNNN>-<title>.md`, template in `docs/decisions/README.md`). Never silently reverse an accepted ADR: write a new one that supersedes it.
4. Update the `Last verified:` line of a doc **only** when you actually compared it to the code. Change its `Status:` when the part's state changes (`planned` → `in progress` → `live (testnet)` → `live (mainnet)`).
5. **The code is the authority.** If a doc contradicts the code, fix the doc and tell the user if the code looks wrong. Do not pick one silently. Do not write what you have not verified; write "not verified" instead.
6. Update `TASKS.md`: tick what you finished (`[x]` + one result line), add follow-ups you discovered, move items between sections. Never delete a task; done items move to "Done" at the bottom.
7. Run `pnpm docs:check` before you finish. It also runs in CI and blocks the merge. A Claude Code stop hook (`.claude/settings.json`) reminds you if code changed without docs.
8. In your final message, list the docs you updated.

## Git and delivery

- `main` is protected: work on a branch (`feat/…`, `fix/…`, `docs/…`, `chore/…`) and open a PR. CI must be green. Merge only when the user explicitly says so.
- `main` deploys to **staging** automatically; **production** is released from a tag (`docs/operations/ci-cd.md`). Never deploy to production, publish an npm package, deploy a contract or push without the user asking.
- Commit messages: English, imperative, short subject, body says *why*. End with the `Co-Authored-By:` line naming the model you are actually running as.
- Small PRs. A PR that changes behaviour updates tests and docs in the same PR.

## Code conventions (summary; details in `docs/architecture/packages.md`)

- TypeScript strict, ESM, pnpm workspaces, Node 22 (`.nvmrc`). Biome for lint/format. Vitest for tests. Zod at every boundary (env, HTTP body, HTTP answer, storage).
- Comments explain *why*, not *what*. No dead code, no flags for features that do not exist.
- Contracts: Foundry (EVM), Soroban/Rust (Stellar), Odra/Rust (Casper), each with its own CI job.

## Language

**Everything in the repository is English**: code, comments, docs, `TASKS.md`, commit messages, UI copy (UI translations live in `packages/content`). **Talk to the owner in Turkish** in the chat (reviewers and other users: their own language).

## The owner

Ezgin (GitHub `Aeztrest`) is the sole owner and currently the only developer. When another identity appears in `git config user.name`, ask who it is and what they own before doing anything, then record contributors and their areas in `docs/README.md` → "People".
