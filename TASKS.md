# Tasks

Last updated: 2026-11-07

The single task list for the project. Every session reads "Now" and "Waiting on a decision" first (`CLAUDE.md`). Rules:

- Format: `- [ ] **T<phase>.<n> Title** — what and why. Done when: … Depends: …`
- Finishing a task: `[x]`, then one indented line `→ result (date, PR/commit)`. Never delete a task; when a phase is done, move its block to "Done" at the bottom.
- Discovered work goes into the right phase (or "Later") in the same commit as the work that discovered it.
- Owner decisions go to "Waiting on a decision" with the options and a recommendation.

---

## Now

**Phase 0 — Foundation**, nearly done; **Phase 1 started** (T1.1 done). Goal of Phase 1: `/v1/analyze` on Monad testnet through the new engine with Metropolis parity. Next up: T1.7 (providers: needs keys to verify live); then Phase 2 (staging deploy: needs the owner's Render/Vercel accounts, T0.9). Owner-side Phase 0 items still open: T0.7, T0.8, T0.9, T0.12–T0.14.

## Waiting on a decision (owner)

Decided on 2026-11-07: D1 (ADRs 0002, 0003, 0006, 0008 accepted), D2 (repo `Aeztrest/baret`, private), D3 (proprietary core + MIT SDKs), D9 (option b: Metropolis's detectors are ported into `chain-evm` first, as they are; the universal ones move into `packages/engine` with the Stellar adapter, T3.7), D8 (no GitHub Pro: no branch protection on the private repo; the PR-only rule in `CLAUDE.md` plus green CI is the gate, and the owner allows Claude to merge its own PRs once CI is green — architecture decisions, deploys, contract deploys and spending still need the owner).

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D4 | Domain(s) for web and API | — | decide before T2.5 |
| D5 | LLM provider for `/v1/explain` and `/v1/policy/draft` | KIMI (legacy) / Qwen / Claude / none in v1 | decide before T2.7 |
| D6 | Shared store for production (limits, caches, API keys) | Render Redis (Key Value) + Postgres / Upstash / Supabase | Render Key Value + Render Postgres: one vendor, one dashboard |
| D7 | x402 settlement chain for Baret's own paid API | Base / Arc / Stellar | decide in Phase 6 with fee data |

## Phase 0 — Foundation

- [x] **T0.1 Architecture, product and operations docs; CLAUDE.md; ADRs; this file** — from a review of all six legacy repos.
  → done 2026-11-07 (planning session)
- [x] **T0.2 Doc and secret checks, CI docs job, session doc-guard hook** — `tooling/docs-check.mjs`, `tooling/secrets-check.mjs`, `.github/workflows/ci.yml`, `.claude/settings.json` + `tooling/hooks/doc-guard.mjs`.
  → done 2026-11-07 (planning session)
- [x] **T0.3 Review the Proposed ADRs (D1)** — accept or amend 0002, 0003, 0006, 0008; update their status lines and the ADR index. Done when: no Phase 1 task depends on a Proposed ADR.
  → all four accepted by the owner, 2026-11-07
- [x] **T0.4 Create the GitHub repository and push** — decided (D2, 2026-11-07): `Aeztrest/baret`, **private** until the first release, transferred to the company org when it exists. protect `main` (PR + CI required, no force-push, linear history); create `release` from `main` with the same protection; enable Dependabot alerts and secret scanning. Done when: CI runs green on GitHub.
  → done 2026-11-07: https://github.com/Aeztrest/baret (private), `main` default, `release` created, CI green on GitHub (PR #3 fixed a workflow error). **Not done:** branch protection and private vulnerability reporting: GitHub offers neither on a private repo of a free personal account (HTTP 403 "Upgrade to GitHub Pro"). See D8. Until then the PR-only rule in `CLAUDE.md` is the protection, and Render deploys only commits whose checks passed.
- [x] **T0.5 License** — decided (D3, 2026-11-07): proprietary core; MIT for the published SDKs (`core`, `guard`, `agent-kit`). Add `LICENSE` at the root (proprietary) and per published package (MIT).
  → root `LICENSE` added 2026-11-07; each published package adds its MIT `LICENSE` when it is created (T1.2, T1.9, T2.8).
- [x] **T0.6 `SECURITY.md`, `CODEOWNERS`** — disclosure contact; owner as code owner of everything.
  → done 2026-11-07 (`SECURITY.md`, `.github/CODEOWNERS`); private vulnerability reporting is switched on with T0.4.
- [ ] **T0.7 Contributor + IP assignment from Meriç and Hale** — they wrote the Metropolis frontend and tests that Phase 2 ports. Done when: signed; recorded in the hub repo (not here). Depends: company formation or a personal agreement.
- [ ] **T0.8 Confirm ownership of the `@baret` npm scope and the `HackerFetch` GitHub org** — `@baret/guard` 0.1.4 was published from Metropolis; publishing 0.2.0 needs the scope.
- [ ] **T0.9 Accounts** — Render workspace, Vercel team, domain (D4), RPC providers (Alchemy/QuickNode for Monad + Base, a trace-capable provider for Arc, Stellar RPC, Casper node/CSPR.cloud).
- [x] **T0.10 Dependency updates** — Renovate or Dependabot config grouping weekly updates; `minimumReleaseAge` in `pnpm-workspace.yaml` as in Metropolis.
  → done 2026-11-07: `.github/dependabot.yml` (npm + actions, weekly, grouped); `minimumReleaseAge: 4320` (3 days).
- [ ] **T0.12 Market research for licences** — which wallets, exchanges and agent platforms on Monad, Stellar, Casper, Arc and Base already buy pre-sign security, from whom, and which chains incumbents do not cover. Output: target list of 20 pilot candidates + a section in `docs/PRODUCT.md`. Why: the business model's main line rests on this.
- [ ] **T0.13 Ecosystem grant applications** — Stellar (SCF), Casper, Monad, Arc/Circle programmes: deadlines, amounts, fit. The model assumes $170k (M3, M6, M10, M15). Output: a grants table in the hub repo with status per programme.
- [ ] **T0.14 Pilot plan** — what a pilot gets (API key, SLA-lite, custom rules), how long, what converts it to a paid licence, a one-page pilot agreement. Target: two pilots starting M7.
- [ ] **T0.11 Hub repo points here** — add a "Code" section to `../README.md` linking the new repo; `baret/` is already gitignored in the hub. Done when pushed (owner asks).

## Phase 1 — Core + EVM parity on Monad testnet

Goal: `POST /v1/analyze` on `eip155:10143` returns the same decisions as Metropolis for every Metropolis scenario, through the new engine.

- [x] **T1.1 Workspace scaffold** — root scripts (`build`, `typecheck`, `test`, `lint`), `biome.json` (from Metropolis), `vitest` workspace, `tsconfig` references; CI `checks` job turns on. Done when: an empty package passes CI.
  → done 2026-11-07: pnpm lockfile, Biome, Vitest projects, `tsc -b` references. The first project is `tooling/` itself: the docs/secrets checks and the doc-guard hook are type-checked (`checkJs`) and covered by 14 tests (`tooling/tooling.test.ts`).
- [x] **T1.2 `packages/core`** — CAIP ids, `Effects`, finding registry, `Verdict`, `GuardPolicy` v2 + templates + `migratePolicyV1`, adapter interfaces. Depends: T0.3.
  → done 2026-11-07 (branch `feat/core`): 10 modules, 21 tests incl. v1 → v2 template parity. Policy design settled while building: all family sections always present; `core.maxFee` replaces per-family fee fields; native floors come from the chain registry (`policyFloors`).
- [x] **T1.3 `packages/chains`** — registry file format + Monad testnet/mainnet + deployments imported from `Baret-Metropolis/docs/CONTRACTS.md` (each address checked on the explorer).
  → done 2026-11-07 (branch `feat/chains`): Monad testnet + Monad entries; testnet `PaymentGuardFactory`, `ReputationRegistry` and USDC (6 decimals) checked with `eth_getCode` / `decimals()` on the public RPC (chain id 10143). Demo-site contracts come with the showcase (T2.4).
- [x] **T1.4 Import-rules script in `tooling/`** — enforces `docs/architecture/packages.md` §4 in CI.
  → done 2026-11-07: `tooling/import-rules.mjs` (`pnpm imports:check`, CI docs job), 5 tests. Enforces the @baret import table and keeps chain libraries inside their own adapter.
- [x] **T1.5 `packages/chain-evm` engine side** — port decode, simulation, effects, EVM detectors with their tests (`docs/migration/porting-plan.md` §3).
  → in progress. Step 1 done 2026-11-07: request schema, `EvmRpc` (batching per chain), decode, trace, ABI, reverts + 18 tests (new decode tests: replay/other-chain refusal, EIP-7702). Step 2 done 2026-11-07: effects, context, format, all ten detectors + policy rules on v2 (42 tests in chain-evm). Step 3 done 2026-11-07: `pipeline.ts` (Metropolis `analyze.ts`), `createEvmAdapter`, on-chain registry source. Mapping `EvmEffects` → core `Effects` moved to T3.7 (not needed until the universal detectors move).
- [x] **T1.6 `packages/engine`** — pipeline, universal detectors, policy evaluation; **parity test** replaying Metropolis scenario fixtures (`apps/server/scripts/export-scenarios.ts`) with expected decisions.
  Note from porting: Metropolis's `decide()` let a fail-closed finding with no rule fall to `allowWarnings`. In v2 `SIGNATURE_NOT_UNDERSTOOD` and `X402_SHAPE_INVALID` are fail-closed with no field, so `decide()` must block them always, and `firedRules[].rule` needs a value for them (make it nullable or add a pseudo field) — decide and test in T1.6.
  → done 2026-11-07: `createEngine` + `decide` (fail-closed fix applied; `firedRules[].rule` is nullable). **Parity: Metropolis's 87 end-to-end scenarios pass** through a v1 ↔ v2 layer (`packages/engine/test/parity`). Found by parity: the lookalike detector still read the v1 payee field. Found with it: the root `tsconfig.json` did not reference `chain-evm` (and `engine`), so `tsc -b` had skipped them since #12; fixed, and `tooling/import-rules.mjs` now fails on an unreferenced typed package.
- [ ] **T1.7 `packages/providers`** — reputation registry reader, Nansen (optional), threat feed.
- [x] **T1.8 `apps/api`** — `/health`, `/health/ready`, `/v1/chains`, `/v1/analyze`, `/v1/policy/templates`; env schema; `.env.example`; built JS start.
  → done 2026-11-07: Fastify app (CORS, per-client limits, headers, keys, `{ error: { code, message } }`), `config.ts`, esbuild bundle, 10 tests. **Checked live** against Monad testnet with the bundle: Safe transfer; NovaSwap drainer approval Blocked (`APPROVAL_UNLIMITED`, `KNOWN_MALICIOUS_ADDRESS` from the on-chain registry). The first smoke run caught an unresolvable external (`viem`) in the bundle: fixed in `scripts/build.mjs`, and CI now runs `pnpm build`.
- [x] **T1.9 `packages/guard` 0.2.0** — client over `core`; README quickstart.
  → done 2026-11-07: client on the v2 contract, re-exports core, 9 tests; `core` and `guard` build to `dist/` for npm (`tsconfig.build.json`, `publishConfig`). Packed tarballs installed in an empty project ran the README call against `apps/api` on Monad testnet: the drainer's sink → Blocked (`KNOWN_MALICIOUS_ADDRESS`), a plain wallet → Safe. Publishing: T2.6 (needs T0.8, the npm scope).
- [x] **T1.10 `contracts/evm`** — port Foundry project (PaymentGuard, factory, registry) + `contracts-evm.yml`.
  → done 2026-11-07: PaymentGuard, PaymentGuardFactory, ReputationRegistry + tests (29, fuzzing) + chain-agnostic `script/Deploy.s.sol`; `forge-std` v1.17.0 as a submodule; `contracts-evm.yml`. The compiled runtime sizes equal the code at the Monad testnet addresses, so those deployments are reused. Nothing deployed.
- [x] **T1.11 CAIP-19 namespaces for Stellar and Casper assets** — decide and write in `docs/architecture/engine.md` §2.
  → decided 2026-11-07: `slip44:<coin type>` for natives (60 on all EVM, 148, 506), `erc20`/`erc721`, `sep41` + `asset:CODE-ISSUER`, `cep18`. Re-check against the CAIP registry in T3.1 / T4.2.
- [ ] **T1.12 Monad mainnet: canonical USDC and a trace-capable RPC** — the registry entry has `usdc: null` and x402 off until both are confirmed.
- [ ] **T1.13 TypeScript 7 upgrade** — Dependabot PR #5 bumps TypeScript 6 → 7 (and Biome, Vitest) and fails CI. Do it as its own task: read the TS 7 migration notes, fix, then merge #5 or replace it. Until then Dependabot ignores TypeScript majors.

## Phase 2 — Frontend, agents and staging

- [x] **T2.1 Port `packages/ui`, `packages/web-ui`, `packages/content`** — re-key finding codes (ADR-0006).
  → in progress: `packages/ui` ported 2026-11-07 (unchanged but for the network-colour comment and the test's Tailwind resolution; typecheck + Tailwind state test green). `content` shared strings ported 2026-11-07: findings re-keyed to v2 + 11 new entries, rules keyed by v2 paths (no hand-kept code lists), chain-neutral wording, copy linter in CI; x402 cap findings now carry `{asset}`. Page strings move with their apps. `web-ui` ported 2026-11-07: unchanged but for CheckBlocks, whose panel and "What changes" strings moved from Metropolis showcase/hub and wallet/sign into a new chain-neutral `shared/check` content; `content` re-exports `FindingCode`; the explain client stays (its `/v1/explain` route comes with T2.7). 76 web-ui + content tests green.
- [ ] **T2.2 `packages/wallet-core` + `chain-evm` wallet side** — keyring with per-family derivation, check-then-sign.
- [ ] **T2.3 `apps/extension`** — port; family flags; EVM accounts and provider; per-chain policy.
- [ ] **T2.4 `apps/web`** — port showcase (Monad scenarios), landing, install, `/agents`, developer portal from route schemas; chain filter.
  → in progress 2026-11-08: landing + not-found page ported with the build pipeline (prerender, heads, sitemap), `middleware.ts`, `vercel.json` (root `vercel.json` removed); `packages/routes` ported; landing copy rewritten for multichain (`content/src/web/home.content.ts`, **owner to review before production**). Next, one PR each: showcase hub + demo sites (with demo contracts in the registry), `/install`, `/agents`, `/docs`, `/partners`. Each removes its path from `PENDING_PATHS`. Vercel project recreated by the owner 2026-11-08: https://baret-nine.vercel.app (production branch `main`, staging content); checked live: landing and 404 prerendered, sitemap/robots/canonical on that domain, `/api/health` through the rewrite answers with `viaEdge: true` (edge secret matches on both sides), security headers present, no console errors. Header and footer no longer link to the Metropolis site and wallet (usebaret.com, wallet.usebaret.com); the header action is Install. Domain choice (custom domain) open.
- [ ] **T2.5 Staging deploy** — `render.yaml` (`baret-api-staging`), Vercel project for `apps/web`, staging domains. Depends: T0.9, D4.
  → in progress 2026-11-07: `render.yaml` (`baret-api-staging`, free plan, Frankfurt, deploy on green checks) merged and checked in a clean clone. Staging API **live** 2026-11-07: https://baret-api-staging.onrender.com (owner created the Blueprint); checked live (deployed commit = `main`, ready with trace, drainer cases Blocked, plain transfer Safe, SDK tarball against it). Vercel: the owner deleted the first project (2026-11-08) and recreates it with Root Directory `apps/web` once the landing is on `main`.
- [x] **T2.11 Per-client rate limits behind Render** — measure how many X-Forwarded-For entries Render's proxy adds (a `forwardedHops` count on `/health`, as Metropolis had), then set `BARET_PROXY_DIRECT_HOPS` on the service. Until then every visitor may share one bucket (Metropolis G-01).
  → done 2026-11-07: `/health` `forwardedHops` (#20) measured 3 on a direct request (4 and 5 with one and two forged entries); `BARET_PROXY_DIRECT_HOPS=3` in `render.yaml`; unit test of the measured shape. The web app's edge hops are set with T2.4.
- [ ] **T2.12 Per-chain network colour** — Metropolis has one network colour (Monad violet) that states "you are on this network". Add a `brandColor` to each chain registry entry and a `--color-network` token the UI sets per chain.
- [ ] **T2.6 Release pipeline** — changesets, `release.yml`, `chain-check.yml`, extension zips on releases.
- [ ] **T2.7 `/v1/explain`, `/v1/policy/draft`, `/mcp`, `/v1/audit/*`** — depends D5; audit needs the Envio indexer (decide its location, porting plan §3).
- [ ] **T2.8 `packages/agent-kit` (EVM) + CLI** — port; x402 buyer (EIP-3009).
- [ ] **T2.9 Browser end-to-end tests** — Playwright: extension sign flow, two showcase scenarios.
- [ ] **T2.10 Usage metering and API keys (moved forward from Phase 6)** — per-key usage counted per chain and per day, simple key issuance by the owner; no billing yet. Why: the first pilots (M7–9 in the business model, `docs/PRODUCT.md` §4) must show who used what. Depends: D6 (store) or a minimal Postgres.

## Phase 3 — Stellar

- [ ] **T3.1 `packages/chain-stellar` engine side** — port from Baret-Stellar; map to `Effects`; Stellar detectors; tests from real testnet and pubnet XDRs.
- [ ] **T3.2 `contracts/stellar`** — port `merchant-spend-policy` + `contracts-stellar.yml`; verify testnet and mainnet deployments; registry entries.
- [ ] **T3.3 `chain-stellar` wallet side** — SEP-0005 derivation; passkey-kit smart wallet; sub-key mandates; x402 auth entries.
- [ ] **T3.4 Extension: Stellar accounts and dApp provider** — research SEP-43 / Stellar Wallets Kit first; ADR if a convention must be chosen.
- [ ] **T3.5 Showcase: Stellar scenarios; agent-kit: Stellar.**
- [ ] **T3.7 Lift the universal detectors into `packages/engine`** (D9) — with EVM and Stellar both ported, move approvals, contracts, reputation, lookalike, compliance, complexity, x402 and the policy rules out of `chain-evm` to work on core `Effects`; family-only parts stay in the adapters. The Metropolis parity tests (T1.6) must stay green through the move.
- [ ] **T3.6 Renew the Stellar mainnet agent authority** — expired 2026-11-06 (hub README); needed before the next investor demo.

## Phase 4 — Casper

- [ ] **T4.1 Research: transaction simulation on Casper 2.x** — speculative execution endpoint, public provider support, own node cost. Output: section in `docs/chains/casper.md` + ADR if a node is needed.
- [ ] **T4.2 `packages/chain-casper` engine side** — port intent decoding and detectors; `SESSION_CODE_EXECUTION`; effects mapping.
- [ ] **T4.3 `contracts/casper`** — port Odra contracts + CI; verify deployments; registry.
- [ ] **T4.4 Casper wallet side and provider** — derivation compatible with Casper Wallet; Casper Wallet API / CSPR.click.
- [ ] **T4.5 Showcase: Casper scenarios; agent-kit: Casper.**

## Phase 5 — More EVM chains

- [ ] **T5.1 Arc** — confirm chain ids; trace-capable RPC provider; USDC-as-gas in fee and loss maths; deploy PaymentGuard.
- [ ] **T5.2 Base Sepolia / Base** — registry, RPC, deploy PaymentGuard.
- [ ] **T5.3 ADR: non-custodial EVM spend limit** — session keys / ERC-7579 module vs. the current vault.

## Phase 6 — Mainnet and revenue

- [ ] **T6.1 Audits** — EVM contracts, then Stellar, Casper; extension key handling review.
- [ ] **T6.2 Production infrastructure** — paid Render plan, shared store (D6), monitoring and alerting, error tracking.
- [ ] **T6.3 Paid API** — billing on top of T2.10 metering (licence invoicing, developer plans checkout), x402 paywall on `/v1/analyze` (D7).
- [ ] **T6.4 Mainnet deployments** — multisig owners, hardware deployer, registry, release `v1.0.0`.
- [ ] **T6.5 Store listings** — Chrome Web Store, Firefox AMO.
- [ ] **T6.6 Legal** — privacy policy, terms (`Baret-Metropolis/docs/next-steps/mainnet-readiness.md` §8).

## Later (backlog)

- Passkey web wallet per family (Stellar passkey-kit first; Mera on Monad).
- MetaMask Agent Wallet plugin; Qwen agent reviewer; sealed on-chain settings; Chainlink CRE reputation oracle; Cleanverse settlement.
- Signed verdict attestations (`Verdict.attestation`).
- `/v1/analyze/batch`, streaming.
- Families: Solana (BLACKTHORN), Midnight (Baret-Midnight); chain: GOAT.

## Done

(Phase blocks move here when complete.)
