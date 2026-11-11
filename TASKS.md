# Tasks

Last updated: 2026-11-07

The single task list for the project. Every session reads "Now" and "Waiting on a decision" first (`CLAUDE.md`). Rules:

- Format: `- [ ] **T<phase>.<n> Title** — what and why. Done when: … Depends: …`
- Finishing a task: `[x]`, then one indented line `→ result (date, PR/commit)`. Never delete a task; when a phase is done, move its block to "Done" at the bottom.
- Discovered work goes into the right phase (or "Later") in the same commit as the work that discovered it.
- Owner decisions go to "Waiting on a decision" with the options and a recommendation.

---

## Now

**NEAR HACKATHON week (2026-11-08 → 11-14)**: see the section below; Phase 2 pauses. Before it: Phase 1 done, Phase 2 web app ported up to the six demo sites. After the hackathon: T2.4 (`/docs`, `/partners`), T2.2/T2.3 (wallet-core, extension), T1.7 (providers). Owner-side Phase 0 items still open: T0.7, T0.8, T0.9, T0.12–T0.14.

## Waiting on a decision (owner)

Decided on 2026-11-07: D1 (ADRs 0002, 0003, 0006, 0008 accepted), D2 (repo `Aeztrest/baret`, private), D3 (proprietary core + MIT SDKs), D9 (option b: Metropolis's detectors are ported into `chain-evm` first, as they are; the universal ones move into `packages/engine` with the Stellar adapter, T3.7), D8 (no GitHub Pro: no branch protection on the private repo; the PR-only rule in `CLAUDE.md` plus green CI is the gate, and the owner allows Claude to merge its own PRs once CI is green — architecture decisions, deploys, contract deploys and spending still need the owner).

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D4 | Domain(s) for web and API | — | decide before T2.5 |
| D5 | LLM provider for `/v1/explain` and `/v1/policy/draft` | KIMI (legacy) / Qwen / Claude / none in v1 | decide before T2.7 |
| D6 | Shared store for production (limits, caches, API keys) | Render Redis (Key Value) + Postgres / Upstash / Supabase | Render Key Value + Render Postgres: one vendor, one dashboard |
| D7 | x402 settlement chain for Baret's own paid API | Base / Arc / Stellar | decide in Phase 6 with fee data |
| D10 | Making the repository public (decided 2026-11-08 for NEAR HACKATHON) | when, after which checks | before 2026-11-14 23:59 UTC, after a secrets scan of the full history; the owner says yes at that moment |

## NEAR HACKATHON (2026-11-08 → 2026-11-14 23:59 UTC)

Owner decisions 2026-11-08 (hackathon notes K1, K2, K6, K7): this repository goes **public** before the deadline (D2 changes; D3 licence unchanged); NEAR becomes a chain family now (ADR-0011); scope = vault, function call key, adapter, agent demo, Chain Signatures, NEAR Intents check, web panel, Agent Market listing; tracks `security` + `agents`. Still open with the owner: K3 (mainnet prize account), K4 (hosted demo, Render plan), K5 (X account). The submission itself (form, X post, making the repo public) needs the owner's yes each time.

- [x] **TN.1 Core: the `near` family** — `FAMILIES`, CAIP namespace, `near` policy section (`blockDeleteAccount`, `blockContractDeploy`), finding codes (`ACCOUNT_DELETE_DETECTED`, `CONTRACT_DEPLOY_DETECTED`, `FUNCTION_CALL_KEY_ADDED`, `CHAIN_SIGNATURE_REQUEST`), content, templates, parity tests still green. Tag `pre-hackathon` on the commit before it.
  → done 2026-11-08: family, namespace, `near` policy section in every template, 4 codes with content (shared placeholders plus `{path}`), 2 rule rows; 528 tests and the 87 parity scenarios green; `pre-hackathon` = `bbb5eac`.
- [x] **TN.2 Registry** — `near:testnet` (and `near:mainnet` for Intents) chain entries; RPC env names.
  → done 2026-11-08: `near-testnet.json`, `near.json` (preflight, vault, USDC from Circle checked with `ft_metadata`); env slugs `NEAR_TESTNET`, `NEAR_MAINNET`.
- [x] **TN.3 Vault contract** (`contracts/near`, Rust near-sdk) — deposit, policy, agents, pause, `execute_transfer` (NEAR + NEP-141), limits per transfer and per rolling day, allowlists, error codes; unit tests; CI job. Testnet deploy needs the owner's yes.
  → 2026-11-08: deployed (owner's yes) to `baret-vault.aeztrest-baret.testnet`, tx `7scjYroF5hZ783YgqrdCqRCWciw1q5EgYLE5AMX5Z97m`; policy 1 NEAR per transfer, 3 per day, shop only, 2 NEAR in. Recorded in `packages/chains/deployments/near-testnet.json`.
  → 2026-11-08: `contracts/near/vault` written with 14 unit tests and its CI job (Linux: fmt, test, cargo-near wasm build; Windows lacks NASM for near-sdk's test runtime). Deploy waits for the owner.
- [x] **TN.4 Function call key flow** — script that adds an agent key limited to the vault's `execute_transfer` with an allowance.
  → 2026-11-08: `packages/demo-near/scripts/agent-key.ts` (with keys, accounts, deploy, setup scripts). Runs once the owner has a funded testnet account and says yes to the deploy.
- [x] **TN.5 `packages/chain-near` engine** — decode (JSON + borsh), preflight over RPC, effects, family detectors, adapter registered in `apps/api`; staging serves `near:testnet`.
  → 2026-11-08: adapter built (12 tests: transfers, keys, delete/deploy, vault refusal prediction, NEP-141, unknown contract, Chain Signatures, reported account, x402) and registered in `apps/api`. Staging needs `CHAIN_NEAR_TESTNET_RPC_URL` on Render (owner).
- [x] **TN.6 Agent demo** — TypeScript agent: asks `/v1/analyze`, then calls the vault with its function call key; four scenarios (normal payment, over the limit refused on chain, receiver not allowed, a full access key addition blocked before signing).
  → 2026-11-08: `packages/demo-near` agent CLI with the four scenarios and `--force`; scenario tests. Live run 2026-11-08 against staging: pay Safe and sent; over-limit, wrong-receiver, add-key Blocked; with `--force` the chain refused all three.
- [x] **TN.7 Chain Signatures** — the vault forwards an approved request to the MPC contract; one payment on an EVM testnet limited by the NEAR policy.
  → 2026-11-09: vault `request_evm_signature` (builds the EIP-1559 transfer itself, value + max fee counted, MPC `payload_v2` checked live on testnet), `get_evm_payload` view; engine preflight predicts its refusals; agent `evm-pay` / `evm-wrong-receiver` ask Baret about both chains. Vault upgraded in place 2026-11-09 (owner's yes, state kept). Live: `evm-pay` Safe on both chains, MPC-signed 0.01 MON on Monad testnet (tx `0x2796a4ad…afb8`, status 1, from the vault's derived address `0x9568…5b27`); `evm-wrong-receiver` Blocked on both, `--force` refused by the vault. `/near` lists both runs.
- [x] **TN.8 NEAR Intents check** — read a `dry: true` quote before signing, apply the policy (mainnet, small amounts).
  → 2026-11-09: `request.intents` (the 1Click quote) checked against the deposit: recipient/refund = signer, deposit = quote, app fee shown, loss from the quote's prices; four NEAR codes, `near.blockIntentsMismatch`. A dry quote has no deposit address, so the check takes the real (non-dry) quote: asking for it moves no funds. `pnpm intents-check` asks a real quote and signs nothing. Checked 2026-11-09 against a local API on mainnet with a real quote (read-only, account `aurora`): as given Caution (`INTENTS_APP_FEE`, 20 bps added to keyless quotes); recipient and refund changed Blocked (`INTENTS_RECIPIENT_MISMATCH`, both fields). Staging got `CHAIN_NEAR_MAINNET_RPC_URL` (owner, Render) the same day; `pnpm intents-check` against staging gives the same two verdicts.
- [x] **TN.9 Web panel** — `/near` in `apps/web`: the vault's policy, spending and the latest verdicts.
  → 2026-11-08: `/near` (header nav "NEAR"): vault read live over NEAR RPC in the browser (`demo-near` `view.ts`, `publicRpcUrl` in the registry), the four requests checked live through `/api`, the recorded runs with tx links. Checked in the browser against staging: Safe, Blocked (E_PER_TRANSFER_LIMIT), Blocked (E_RECEIVER_NOT_ALLOWED), Blocked (AUTHORITY_CHANGE).
- [x] **TN.10 Agent Market listing** — owner action with the steps written.
  → 2026-11-09: Agent Market is a hire-and-deliver marketplace, so Baret is listed as an agent that checks a transaction from the brief and delivers the verdict: `pnpm market-agent` (self-hosted worker, `src/market.ts`, 6 tests). Waits for the owner: account (confirmed email), the listing, its price, an agent token in `.env.near`, then one test hire and Live.
  → 2026-11-10: token set (repository secret `NEAR_MARKET_TOKEN` and `.env.agent`); the owner's test hire (0.1 NEAR vault payment to `attacker.testnet`, `near:testnet`) delivered Blocked in 2 s by the worker; listing `@baret` Live (owner). The deliverable now reads in plain words (what to do, what the transaction tries to do, why, codes last) and explains vault refusals (`shared/reasons.content.ts`); the help message's example brief had an empty `actions` list, which the request schema refuses, and now holds a transfer. Open: the hosted pass runs on GitHub's cron, which ran hours apart on 2026-11-09/10 instead of every 10 min, so a hire can wait well past the 15 min SLA unless a worker runs somewhere always on (owner's call).
  → Follow-up: the web panel (`CheckBlocks` `bodyOf`) can show the same refusal reasons for `SIMULATION_FAILED`.
- [~] **TN.11 Submission** — README (try it: do X, see Y), video, X post (owner), repo public + `hackathon-submission` tag (owner's yes), form (payload shown first).
  → 2026-11-09: README rewritten for the hackathon (problem, how it works, a curl try-it checked against staging: Safe / E_PER_TRANSFER_LIMIT, recorded runs, contracts, baseline, limitations). Full git history scanned for keys, tokens, mnemonics, env files and keyed RPC URLs: nothing found. LICENSE: the whole repository is MIT (ADR-0012, owner 2026-11-09); the commit e-mail stays public (owner). Open: video, X post, repo public, tag, form.
- [~] **TN.13 Judge-style review fixes (2026-11-11)** — an independent review from a fresh clone of the public repository, with adversarial requests against staging.
  → 2026-11-11: a transaction spending more than the signer holds made the verdict carry a negative balance, which the verdict schema refuses: the API answered 500. Now `E_INSUFFICIENT_NEAR` / `E_INSUFFICIENT_TOKEN` with `after: null` (test fails without the fix).
  → 2026-11-11: owner methods of a Baret vault were Safe (an agent calling `withdraw`, an owner adding an attacker as receiver or proposing a new owner). Now predicted refusals (`E_NOT_OWNER`, `E_NOT_PENDING_OWNER`) and four new warnings (`VAULT_RECEIVER_ADDED`, `VAULT_AGENT_ADDED`, `VAULT_LIMIT_RAISED`, `VAULT_UNPAUSED`); `propose_owner` → `AUTHORITY_CHANGE`, `update_contract` → `CONTRACT_DEPLOY_DETECTED`; tightening stays unflagged. A Stake action was Safe: now `STAKE_DETECTED`, counted against the post-balance floor. 6 new tests, 5 of them red against the old engine; checked against the real testnet through a local API.
  → 2026-11-11: vault 0.2.1 (code, not deployed yet): the owner's `withdraw_evm` (EVM funds had no owner path: `withdraw` cannot name an EVM asset; it also voids EVM signatures an agent held back, which pausing cannot), version 0.1.0 → 0.2.1 in Cargo.toml, a reproducible NEP-330 build in an image pinned by digest, and clippy actually run in CI (the job named it but never ran it; one lint fixed). 4 new contract tests. Open: deploy 0.2.1 to testnet with `update-vault` from the main CI wasm, release `near-vault-v0.2.1`, update the code hash in the docs.
  → 2026-11-11: the NEAR RPC client retries a 429 / 5xx twice (250 ms, 1 s, +-20% jitter) and honours `Retry-After` up to 2 s; `near:verify` gains three checks (17) and no longer reports an RPC error as a missing key.
- [ ] **TN.12 Review fixes (2026-11-09 review)** — engine: NEP-141 x402 payment read past the 1 yoctoNEAR; NEP-171/178/245 transfers and approvals; `*_transfer_call` receivers; several vault calls in one transaction counted together; a non-vault `execute_transfer` fails closed; the signing key read and checked; the Intents quote confirmed with 1Click by deposit address (forged quotes). Vault 0.2: per-asset receivers, bounded spend history, owner rotation, owner-only code update, the vault's own full access key removed. Demo: the agent process loads only its function call key. Docs and a reviewer guide for the judges.
  → 2026-11-09: engine part done (9 new tests, 3 new codes: `INTENTS_QUOTE_UNVERIFIED`, `NFT_TRANSFER_DETECTED`, `MULTI_TOKEN_TRANSFER_DETECTED`).
  → 2026-11-09: vault 0.2 written (34 unit tests: per-asset receivers, hourly buckets, owner rotation, `update_contract`, 0.1 → 0.2 `migrate`); demo: `.env.agent` by allowlist, `deploy-vault` deletes the vault key, `upgrade-vault` migrates and locks a 0.1 vault, `update-vault`, `verify-vault`; `/near` shows the contract version and the vault's key count; CI prints the wasm's NEAR code hash. Testnet migration of the demo vault: done 2026-11-09 (owner's yes): tx `6gXZFtCb…HVWC` deployed the CI wasm (code hash `7dwH3FLPYFYtPu8weFjuapSrVRveDcqDQQcDyN9xf6sS`, matches CI), migrated (receivers split per asset, spends kept) and deleted the vault key; the vault account holds 0 keys. Owner `update_contract` with the same wasm: tx `E9F2MCz1…UsBU`, state kept. Live runs after it: pay Safe and paid; over-limit, wrong-receiver, add-key Blocked and refused on chain with `--force`; `evm-pay` Safe on both chains, Monad tx `0x736dd215…9004`. `pnpm near:verify` 11/11; after the owner moved staging to FastNEAR, 14/14 with three Intents checks (honest Caution, hostile `INTENTS_RECIPIENT_MISMATCH`, forged `INTENTS_QUOTE_UNVERIFIED`), `pnpm intents-check` runs the same three. Staging answered 503 for some NEAR calls: rpc.testnet.near.org took about 3 s per call; the RPC client now retries once and reads in parallel, the registry and the demo default to FastNEAR, and staging's `CHAIN_NEAR_*_RPC_URL` should move to FastNEAR (owner, Render).
  → 2026-11-09: reviewer guide `docs/hackathon/near-2026.md` (why agentic payments need both lines of defence, claims → evidence, threat model, what was built in the window), `AGENTS.md`, a reviewer note at the top of `CLAUDE.md` (the owner-session rules do not apply to judges' agents), README rewritten around it; `pnpm near:verify` (11 live checks, no key; 9/11 before the vault migration, the two left are the ones it fixes); Agent Market worker resubmits a deliverable it could not send; `keep-warm.yml` pings staging every 10 min through November.

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
  → 2026-11-09: superseded by ADR-0012: the whole repository is MIT.
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
- [ ] **T1.14 Flaky API test under load** — `apps/api` `src/app.test.ts` "answers a verdict" times out (13 s) during a full `pnpm check` on a loaded machine and passes alone (seen 2026-11-08 and 2026-11-09). Find the slow step (cold imports of the adapters?) and fix it, not the timeout.
- [ ] **T1.15 Flaky web SSR test in CI** — `apps/web/src/entry-server.test.tsx` once ended with an unhandled `ReferenceError: window is not defined` (CI run 42542622239, PR #45, 2026-11-09); the same commit passed on main and locally. Likely a page effect (a fetch or timer) finishing after the happy-dom environment is torn down; find which page and clean it up.

## Phase 2 — Frontend, agents and staging

- [x] **T2.1 Port `packages/ui`, `packages/web-ui`, `packages/content`** — re-key finding codes (ADR-0006).
  → in progress: `packages/ui` ported 2026-11-07 (unchanged but for the network-colour comment and the test's Tailwind resolution; typecheck + Tailwind state test green). `content` shared strings ported 2026-11-07: findings re-keyed to v2 + 11 new entries, rules keyed by v2 paths (no hand-kept code lists), chain-neutral wording, copy linter in CI; x402 cap findings now carry `{asset}`. Page strings move with their apps. `web-ui` ported 2026-11-07: unchanged but for CheckBlocks, whose panel and "What changes" strings moved from Metropolis showcase/hub and wallet/sign into a new chain-neutral `shared/check` content; `content` re-exports `FindingCode`; the explain client stays (its `/v1/explain` route comes with T2.7). 76 web-ui + content tests green.
- [ ] **T2.2 `packages/wallet-core` + `chain-evm` wallet side** — keyring with per-family derivation, check-then-sign.
- [ ] **T2.3 `apps/extension`** — port; family flags; EVM accounts and provider; per-chain policy.
- [ ] **T2.4 `apps/web`** — port showcase (Monad scenarios), landing, install, `/agents`, developer portal from route schemas; chain filter.
  → in progress 2026-11-08: landing + not-found page ported with the build pipeline (prerender, heads, sitemap), `middleware.ts`, `vercel.json` (root `vercel.json` removed); `packages/routes` ported; landing copy rewritten for multichain (`content/src/web/home.content.ts`, **owner to review before production**). Showcase hub (`/showcase`) ported 2026-11-08: the six scenario cards now live in `content/src/web/hub.content.ts` (`sites`, each with its CAIP-2 chain) so the hub renders before the sites; the cards link to the pending demo paths. ADR-0010 (owner, 2026-11-08): demo-site chain code goes to `packages/demo-evm`; done the same day with the 18 demo addresses in the registry's `showcase` section (listed ones are known contracts in the API). Partners (owner, 2026-11-08): keep the providers Baret uses or plans to, drop the rest, and widen the page to Stellar and Casper. Live check of the 18 scenarios (`demo-evm` `verify`) against staging 2026-11-08: 16 agree; NovaSwap needed dUSDC listed (fixed). Demo kit ported 2026-11-08 (panel, frame, wallet in `demo-evm/wallet`, v2 verdict mapping; the Baret web wallet window dropped). The six demo sites ported 2026-11-08 (`/scrybe`, `/novaswap`, `/pixeldrop`, `/orbityield`, `/claimhub`, `/launchpad`; their copy in `content/src/web/<site>.content.ts`, sample answers moved to v2 codes and values). Not carried over: the Baret web wallet window paths and their tests; Scrybe's "pay with your wallet" calls `/api/demo/paywall`, which `apps/api` does not have yet (T2.13). Next, one PR each: `/docs`, `/partners`, then `/install` (after the extension, T2.3) and `/agents` (after agent-kit, T2.8). Each removes its path from `PENDING_PATHS`. Vercel project recreated by the owner 2026-11-08: https://baret-nine.vercel.app (production branch `main`, staging content); checked live: landing and 404 prerendered, sitemap/robots/canonical on that domain, `/api/health` through the rewrite answers with `viaEdge: true` (edge secret matches on both sides), security headers present, no console errors. Header and footer no longer link to the Metropolis site and wallet (usebaret.com, wallet.usebaret.com); the header action is Install. Domain choice (custom domain) open.
- [ ] **T2.5 Staging deploy** — `render.yaml` (`baret-api-staging`), Vercel project for `apps/web`, staging domains. Depends: T0.9, D4.
  → in progress 2026-11-07: `render.yaml` (`baret-api-staging`, free plan, Frankfurt, deploy on green checks) merged and checked in a clean clone. Staging API **live** 2026-11-07: https://baret-api-staging.onrender.com (owner created the Blueprint); checked live (deployed commit = `main`, ready with trace, drainer cases Blocked, plain transfer Safe, SDK tarball against it). Vercel: the owner deleted the first project (2026-11-08) and recreates it with Root Directory `apps/web` once the landing is on `main`.
- [x] **T2.11 Per-client rate limits behind Render** — measure how many X-Forwarded-For entries Render's proxy adds (a `forwardedHops` count on `/health`, as Metropolis had), then set `BARET_PROXY_DIRECT_HOPS` on the service. Until then every visitor may share one bucket (Metropolis G-01).
  → done 2026-11-07: `/health` `forwardedHops` (#20) measured 3 on a direct request (4 and 5 with one and two forged entries); `BARET_PROXY_DIRECT_HOPS=3` in `render.yaml`; unit test of the measured shape. The web app's edge hops are set with T2.4.
- [ ] **T2.13 Scrybe's x402 paywall route** — Metropolis served `/demo/paywall` (a 402 with Scrybe's terms, then settlement of the signed EIP-3009 transfer) for Scrybe's real payment. Port it into `apps/api` (behind a feature flag, testnet only, with the settlement key as a Render secret) or hide the pay button. Until then the button answers with an error. Depends: owner (a funded settlement key).
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
