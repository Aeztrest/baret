# Documentation index

Status: **live** (this index is enforced by `pnpm docs:check`)
Last verified: 2026-11-07

How the docs are organised, which doc owns which code, and the rules that keep them current. The working rules for agents are in `CLAUDE.md`; the task list is `TASKS.md`.

## Reading order for a newcomer

1. `README.md` (repo root) — what Baret is, how to run it.
2. `docs/PRODUCT.md` — who it is for and what it promises.
3. `docs/ARCHITECTURE.md` — the map.
4. `TASKS.md` — where we are.
5. The deep dive for your area (table below).

## All documents

| Doc | What it owns |
|---|---|
| `docs/PRODUCT.md` | Problem, users, surfaces, scope, non-goals, glossary |
| `docs/ARCHITECTURE.md` | The map: layers, flows, state, topology |
| `docs/architecture/packages.md` | Every package and app, import rules, conventions |
| `docs/architecture/engine.md` | Analysis pipeline, effects model, detectors, policy, verdict |
| `docs/architecture/chain-adapters.md` | The adapter interfaces and the checklist for adding a chain or family |
| `docs/architecture/api.md` | HTTP routes, auth, limits, errors, MCP |
| `docs/architecture/frontend.md` | Extension, web app, shared UI and content |
| `docs/architecture/sdk.md` | `@baret/guard`, `@baret/agent-kit`, publishing |
| `docs/architecture/x402.md` | x402 buyer and seller sides, per family |
| `docs/architecture/contracts.md` | Contracts per family, deployment registry |
| `docs/architecture/providers.md` | External data and model providers |
| `docs/chains/README.md` | Support matrix: every chain, its status and features |
| `docs/chains/evm.md` | EVM family (Monad, Arc, Base, …) |
| `docs/chains/stellar.md` | Stellar family |
| `docs/chains/casper.md` | Casper family |
| `docs/operations/ci-cd.md` | GitHub Actions, branches, releases |
| `docs/operations/deployment.md` | Render, Vercel, extension, npm, contracts |
| `docs/operations/environments.md` | Environments and every environment variable |
| `docs/operations/security.md` | Threat model, keys, secrets, audit plan |
| `docs/decisions/README.md` | ADR index and template |
| `docs/migration/porting-plan.md` | What is ported from which legacy repo, and how |

## Code ↔ doc map

When you change a path on the left, update the docs on the right in the same commit (`CLAUDE.md` → documentation protocol).

| Path changed | Update |
|---|---|
| `packages/core/**` | `docs/architecture/engine.md` (types), `docs/architecture/chain-adapters.md` (interfaces) |
| `packages/engine/**` | `docs/architecture/engine.md`; new finding code → its table there and `packages/content` |
| `packages/chains/**` | `docs/chains/README.md`, `docs/chains/<family>.md`; new deployment → `docs/architecture/contracts.md` |
| `packages/chain-evm/**` | `docs/chains/evm.md` |
| `packages/chain-stellar/**` | `docs/chains/stellar.md` |
| `packages/chain-casper/**` | `docs/chains/casper.md` |
| `packages/providers/**` | `docs/architecture/providers.md`, `docs/operations/environments.md` |
| `packages/guard/**`, `packages/agent-kit/**` | `docs/architecture/sdk.md`, the package README, `CHANGELOG` via changeset |
| `packages/wallet-core/**`, `packages/ui/**`, `packages/web-ui/**`, `packages/routes/**`, `packages/content/**` | `docs/architecture/frontend.md` |
| `apps/api/**` | `docs/architecture/api.md`; env → `docs/operations/environments.md` |
| `apps/extension/**`, `apps/web/**` | `docs/architecture/frontend.md` |
| `contracts/**` | `docs/architecture/contracts.md`, `docs/chains/<family>.md` |
| `.github/**`, `render.yaml`, `**/vercel.json` | `docs/operations/ci-cd.md`, `docs/operations/deployment.md` |
| any `.env.example` | `docs/operations/environments.md` |
| `tooling/**` | this file (rules section), `CLAUDE.md` if the protocol changes |
| an architectural choice | new ADR in `docs/decisions/` |

## Rules for every doc

1. **Header.** Every doc under `docs/` starts with a title, then `Status:` and `Last verified:` lines. Status is one of `planned`, `in progress`, `live (testnet)`, `live (mainnet)`, `superseded`. `docs:check` enforces the header.
2. **One owner per fact.** A fact (an env variable, an address, a route) is written in one doc and linked from others, never copied. The owner is the table above.
3. **Planned vs. built.** While a part is `planned`, its doc describes the target. When code lands, the doc is rewritten to describe the code, and anything not built is listed under "Not built yet".
4. **No secrets, no private URLs with tokens.**
5. **Paths in backticks are checked.** A path like `apps/api/src/main.ts` written in backticks must exist once its package exists (`docs:check` skips paths under packages that are still `planned`; see `tooling/docs-check.mjs`).
6. **English only.**

## What `pnpm docs:check` verifies

- every `docs/**/*.md` is listed in the table above, and every listed doc exists;
- every doc under `docs/` has a `Status:` and `Last verified:` header;
- relative Markdown links resolve;
- backticked repo paths exist (for packages that exist);
- every `apps/*` and `packages/*` directory has a `README.md` and appears in `docs/architecture/packages.md`;
- every chain JSON in `packages/chains/` has a row in `docs/chains/README.md` (once the package exists);
- every variable in any `.env.example` appears in `docs/operations/environments.md`;
- every ADR file is listed in `docs/decisions/README.md`.

The checks themselves are tested: `tooling/tooling.test.ts` runs `docs-check`, `secrets-check` and the doc-guard hook against scratch trees (part of `pnpm test`).

It cannot tell whether a sentence is still true. That is what the protocol in `CLAUDE.md` and the review of each PR are for.

## People

| Person | GitHub | Area |
|---|---|---|
| Ezgin | `Aeztrest` | Owner; everything |
