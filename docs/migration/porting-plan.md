# Porting plan: legacy repos → this repo

Status: **in progress** (nothing ported yet; this is the map every porting task follows)
Last verified: 2026-11-07

The legacy repos sit next to this repo on the owner's machine (`../Baret-Metropolis`, `../Baret-Stellar`, `../CasperBaret`, `../Baret-GOAT`, `../Baret-Midnight`, `../BLACKTHORN`) and on GitHub (links in the hub repo README). They are **read, never merged**.

## 1. How to port a piece

1. Pick the task in `TASKS.md`; read the source files and the legacy doc/decision that explains them.
2. Copy into the target path; rename to the new names (§4); remove chain assumptions the target package may not have (`docs/architecture/packages.md` §4).
3. Port its tests with it. A ported file without its tests is not ported.
4. Record the legacy decision it carries in a comment only when the *why* is not obvious (e.g. `// "Unlimited" starts at max uint96: see Metropolis D-049`), and in the target doc.
5. Update the target doc (status, "Not built yet" list) and tick the task.

## 2. Source of truth per area

| Area | Primary source | Also read | Why |
|---|---|---|---|
| Engine pipeline, policy, findings | Baret-Metropolis | Baret-Stellar, CasperBaret | Most detectors (45 codes), strict fail-closed policy registry |
| EVM adapter | Baret-Metropolis `apps/server/src/{simulation,analysis,risk}` | Baret-GOAT (configurable chain, RPC batching quirk) | Real trace-based simulation |
| Stellar adapter | Baret-Stellar `apps/server` | — | Only Stellar implementation; mainnet proof |
| Casper adapter | CasperBaret `apps/server/src/analyze`, `packages/casper-core` | — | Only Casper implementation; simulation must be added |
| API server shell | Baret-Metropolis `apps/server/src/api`, `config` | Baret-Stellar (API keys, OpenAPI test, x402 paywall) | |
| SDK `guard` | Baret-Metropolis `packages/guard` | Baret-Stellar `swig-guard` | Published 0.1.4 |
| `agent-kit` | Baret-Metropolis `packages/agent-kit` | Baret-Stellar `agent-guard` (attestation verify) | |
| Extension | Baret-Metropolis `apps/extension` | Baret-Stellar extension (x402 mandates, sub-keys), CasperBaret extension | Most finished UI and real wallet |
| Web | Baret-Metropolis `apps/showcase` | Stellar and Casper showcases (their scenarios) | |
| Design system, content | Baret-Metropolis `packages/ui`, `web-ui`, `content`, `docs/BRAND.md` | — | |
| EVM contracts | Baret-Metropolis `contracts` | Baret-GOAT contracts | Deployed, tested |
| Stellar contract | Baret-Stellar `contracts/contracts/merchant-spend-policy` | — | Mainnet |
| Casper contracts | CasperBaret `contracts` | — | |
| CI/deploy patterns | Baret-Metropolis `.github/workflows`, `render.yaml`, `apps/*/vercel.json` | Baret-Stellar `scripts/check-docs.mjs`, `check-secrets.mjs` | |
| Indexer | Baret-Metropolis `indexer` | — | Envio, Monad |
| Not ported now | Metropolis `workflows/` (CRE), `packages/metamask-plugin`, `apps/wallet`, `SealedStore`, Qwen review route; Baret-Midnight; BLACKTHORN | — | ADR-0005, backlog |

## 3. File map (first phases)

| Legacy (Baret-Metropolis unless noted) | Target |
|---|---|
| `packages/guard/src/{analyze,policy,findings,policy-templates,chains}.ts` | split: schemas/types → `packages/core`; client + helpers → `packages/guard` |
| `apps/server/src/application/analyze.ts` | `packages/engine/src/analyze.ts` (pipeline) + `packages/chain-evm/src/engine/*` (EVM steps) |
| `apps/server/src/simulation/*` | `packages/chain-evm/src/engine/simulation/*` |
| `apps/server/src/analysis/*` | `packages/chain-evm/src/engine/effects/*` (producing core `Effects`) |
| `apps/server/src/risk/detectors/{approvals,programs,reputation,lookalike,compliance,cpi,compute,simulation,x402}.ts` | universal parts → `packages/engine/src/detectors/*`; EVM-only parts → `packages/chain-evm/src/engine/detectors/*` |
| `apps/server/src/risk/detectors/evm-danger.ts` | `packages/chain-evm/src/engine/detectors/evm-danger.ts` |
| `apps/server/src/policy/evaluate.ts` | `packages/engine/src/policy/evaluate.ts` |
| `apps/server/src/sources/*` | `packages/providers/src/*` |
| `apps/server/src/infra/rpc.ts` | `packages/chain-evm/src/rpc.ts` |
| `apps/server/src/api/*`, `config/env.ts`, `main.ts` | `apps/api/src/*` |
| `packages/llm` | `packages/providers/src/llm/*` |
| `packages/agent-kit` | `packages/agent-kit` (+ `chain-evm/wallet` for signing) |
| `packages/wallet-core` | `packages/wallet-core` (rewritten around adapters) + `chain-evm/src/wallet/*` |
| `packages/ui`, `packages/web-ui` | same paths |
| `packages/content` | `packages/content` (codes re-keyed, ADR-0006) |
| `apps/extension` | `apps/extension` |
| `apps/showcase` | `apps/web` |
| `contracts/` | `contracts/evm/` |
| `indexer/` | `apps/indexer-evm/` or kept outside the workspace (decide in Phase 2) |
| Baret-Stellar `apps/server/src/{domain,simulation,application}` | `packages/chain-stellar/src/engine/*` |
| Baret-Stellar `contracts/contracts/merchant-spend-policy` | `contracts/stellar/merchant-spend-policy` |
| CasperBaret `apps/server/src/analyze/*`, `packages/casper-core` | `packages/chain-casper/src/{engine,wallet}/*` |
| CasperBaret `contracts/` | `contracts/casper/` |

## 4. Renames

| Legacy | New |
|---|---|
| `MONAD_TESTNET_*` / `MONAD_MAINNET_*` env | `CHAIN_MONAD_TESTNET_*` / `CHAIN_MONAD_*` |
| `DELTAG_*` env (Stellar) | `BARET_*` |
| `@stellar-thorn/*`, `swig-guard`, `agent-guard` | `@baret/*`, `guard`, `agent-kit` |
| `ERC20_APPROVAL_*`, `SOROBAN_ALLOWANCE_*`, `CEP18_ALLOWANCE_*` | `APPROVAL_*` |
| `NANSEN_*` finding codes | `REPUTATION_*` |
| `EXCESSIVE_GAS`, `EXCESSIVE_BASE_FEE`, `EXCESSIVE_RESOURCE_FEE` | `EXCESSIVE_FEE` |
| `OWNERSHIP_TRANSFER`, `SIGNER_CHANGE_DETECTED`, `THRESHOLD_CHANGE_DETECTED` | `AUTHORITY_CHANGE` |
| `minPostUsdcBalance`, `minPostNativeBalance` | `core.minPostBalances[]` |
| `minNansenTrustLevel` | `core.minReputationTrust` |

## 5. Known legacy gaps not to carry over

From `Baret-Metropolis/docs/SYSTEM_GAPS.md`: shared rate-limit bucket behind the proxy (G-01), the API sleeping (G-03), in-memory server state (G-10), no browser tests (G-20), docs naming things never built (G-21). From Baret-Stellar: an empty policy that blocked almost nothing; in-memory audit store; API keys on an ephemeral disk. From CasperBaret: no simulation; unused scaffold packages.
