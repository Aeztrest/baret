# Baret — Architecture

Status: **planned** (no code yet; parts are ported from the legacy repos per `docs/migration/porting-plan.md`)
Last verified: 2026-11-07 (written; nothing to verify against yet)

> **This file is the map.** It says what the parts are, how they depend on each other and how a request flows. Every part has a deep-dive doc (listed in §9). When code exists, the code is the authority: if this file disagrees with it, fix this file.

---

## 1. What the system does

Baret steps in at the moment of signing, on any supported chain:

```
wallet / dApp / agent wants to sign
          │
          ▼
   decode  ──►  simulate (against pinned chain state)  ──►  normalise effects
                                                                 │
          ┌──────────────────────────────────────────────────────┘
          ▼
   sources (reputation, compliance)  ──►  detectors  ──►  owner's policy  ──►  verdict
                                                                     safe / caution / blocked
                                                                     + findings, balance changes,
                                                                       allowances, confidence
```

For agents, a second line of defence lives **on chain**: a spend limit the agent cannot exceed even if its key leaks (EVM `PaymentGuard` vault, Stellar `MerchantSpendPolicy` policy signer, Casper `PaymentGuard` vault).

## 2. Design principles

1. **One engine, many chains.** The pipeline, the policy model, the verdict and every surface are chain-agnostic. Each chain *family* (EVM, Stellar, Casper; later Solana, Midnight) is one adapter package that turns its transactions into a common **effects** model. Adding a chain inside an existing family is configuration; adding a family is one new adapter package. (ADR-0003)
2. **Standard identifiers.** CAIP-2 chains, CAIP-10 accounts, CAIP-19 assets everywhere outside an adapter. (ADR-0002)
3. **Fail-closed.** No data → no `safe`.
4. **The policy is the owner's data; the engine is Baret's code.** `GuardPolicy` is JSON, versioned, portable between wallet, SDK and API.
5. **The server is an input, the signer decides.** The wallet and the agent-kit refuse to sign on `blocked` or when the server cannot be reached; the on-chain limit holds even if every off-chain part is compromised.
6. **External providers are optional, never silent.** A provider that is off or down shows up as `unavailable` in the verdict and fails the rules that needed it. (ADR-0005)
7. **Codes, not sentences.** The engine emits finding codes with values; all words live in `packages/content` (translatable, testable).

## 3. Layers and packages

```
┌───────────────────────────── Surfaces ─────────────────────────────────────┐
│ apps/extension  multichain browser wallet (MV3)                            │
│ apps/web        landing + threat showcase + /agents + developer portal     │
│ apps/api        Fastify HTTP API + MCP (the engine as a service)           │
│ SDK consumers   @baret/guard (dApps, wallets) · @baret/agent-kit (agents)  │
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────── Shared client side ────────────────────────────┐
│ packages/wallet-core   keyring (one seed → accounts per family), sessions  │
│ packages/ui · web-ui   design system         packages/content  all words  │
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────── Engine ────────────────────────────────────┐
│ packages/engine     pipeline, universal detectors, policy evaluation       │
│ packages/providers  reputation, compliance, prices, LLM (optional sources) │
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────── Chains ────────────────────────────────────┐
│ packages/chain-evm · chain-stellar · chain-casper                          │
│   ./engine  decode, simulate, effects, family detectors   (server side)    │
│   ./wallet  derive keys, balances, build, sign, send, x402 (client side)   │
│ packages/chains     registry: CAIP-2 ids, RPC env names, features,         │
│                     deployments/*.json (contract addresses)                │
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────── Contracts (no deps) ───────────────────────┐
│ packages/core   types + zod schemas: ids, Effects, Finding, Verdict,       │
│                 GuardPolicy, adapter interfaces                            │
└────────────────────────────────────────────────────────────────────────────┘
On chain:  contracts/evm (Foundry) · contracts/stellar (Soroban) · contracts/casper (Odra)
```

**Dependency rule: arrows only point down.** `core` depends on nothing but zod. `guard` (public SDK) depends only on `core`, so a dApp can use it without any chain library. Apps never import `engine` internals or chain libraries directly. Full import matrix and how CI enforces it: `docs/architecture/packages.md`.

## 4. Chain support model

| Family | Chains (first targets) | Simulation | On-chain limit | Source repo |
|---|---|---|---|---|
| EVM | Monad testnet/mainnet, Arc, Base; GOAT later | `eth_call` + `debug_traceCall` at a pinned block | `PaymentGuard` vault (+ factory) | Baret-Metropolis (+ Baret-GOAT) |
| Stellar | testnet, pubnet | Horizon/RPC state + Soroban `simulateTransaction` | `MerchantSpendPolicy` (policy signer on a passkey smart wallet, non-custodial) | Baret-Stellar |
| Casper | casper-test, casper | to be researched (speculative execution) — legacy repo had none | `PaymentGuard` vault + `Cep18x402` token | CasperBaret |
| Solana / Midnight | later | — | — | BLACKTHORN / Baret-Midnight |

A chain is **enabled** in a deployment only when its RPC variables are set; `GET /v1/chains` tells clients what this server supports and with which features (trace, x402, vault, indexer). Details per family: `docs/chains/`.

## 5. Main flows

### 5.1 Analysis (`POST /v1/analyze`)

```
client (wallet / SDK / agent / MCP)
  │  { chain: "eip155:10143", request: <family payload>, policy | policyTemplate, account?, payment? }
  ▼
apps/api       rate limit · auth (API key or x402) · zod validation · chain enabled?
  ▼
engine.analyze(chain, request, policy)
  [1] adapter = registry.adapterFor(chain)                 (family lookup)
  [2] state   = adapter.pin(chain)                         block / ledger / state root; every read below uses it
  [3] tx      = adapter.decode(request)                    family-native decoded form, chain id checked
  [4] sim     = adapter.simulate(tx, state)                may degrade to "no simulation" → confidence low
  [5] fx      = adapter.effects(tx, sim)                   → normalised Effects (core types)
  [6] facts   = providers.lookup(fx.counterparties)        reputation, compliance; each ok | unavailable | skipped
  [7] findings= universal detectors(fx, facts) + adapter.detectors(tx, sim, fx)
  [8] verdict = policy.evaluate(findings, fx, policy)      fail-closed rules, fired rules, suggestions
  ▼
Verdict { decision, findings, firedRules, suggestions, confidence, estimatedChanges, allowances,
          sources, chain, pinnedAt, expiresAt, meta { requestId, engineVersion } }
```

Deep dive: `docs/architecture/engine.md` (pipeline, effects model, detectors, policy), `docs/architecture/api.md` (routes, auth, limits).

### 5.2 A person signs in the extension

```
dApp ──provider call (EIP-1193 / Stellar / Casper provider)──► content script ──► background
  background: queue request → open approval window
  approval window: wallet-core.check(request) → @baret/guard → /v1/analyze → verdict card
  person: Sign / Reject   (Blocked: deliberate override with a hold, never one click; unreachable server = Blocked)
  background: chain-<family>/wallet.sign → (send) → result to dApp
```

Deep dive: `docs/architecture/frontend.md`.

### 5.3 An agent pays (x402) or calls a contract

```
agent ──► @baret/agent-kit AgentWallet.guardedSubmit(call, { intent })
            │ verdict from /v1/analyze (Safe only; Caution needs allowCaution; unreachable = refuse)
            ▼
          signer (local key / MPC) signs ──► chain
            ▼
          on-chain limit checks the payment (vault caps or policy signer) — holds even if the agent is compromised
```

x402: the 402 `PaymentRequirements` are checked by the policy (merchant, asset, per-tx/hour/day caps) before the family adapter signs the payment authorisation. Deep dive: `docs/architecture/x402.md`, `docs/architecture/sdk.md`.

## 6. State: where data lives

| Data | Where | Notes |
|---|---|---|
| Keys (seed, derived keys) | extension IndexedDB, encrypted with the passphrase; agent signers in the agent's environment | never sent to the server |
| Policy per account per chain | extension storage; SDK caller; agent config | the server never stores a user's policy |
| Verdict cache (explain, short TTL) | api memory → Redis-compatible store before mainnet | ADR pending (TASKS) |
| Audit / history | per-family indexer (Envio for EVM first); absent → API answers 503, never an empty list | |
| Contract addresses | `packages/chains/deployments/*.json` | committed, reviewed |
| API keys, usage | api store (Postgres planned, Phase 6) | |

## 7. Deployment topology

| Piece | Host | Environments |
|---|---|---|
| `apps/api` | Render (web service, Frankfurt) | `baret-api-staging` (testnets, auto from `main`), `baret-api` (production, from release tag) |
| `apps/web` | Vercel | PR previews → staging API; production on release |
| `apps/extension` | GitHub Release zips (CI); Chrome Web Store / Firefox AMO later | |
| `@baret/guard`, `@baret/agent-kit` | npm (changesets, on release) | |
| Contracts | deployed by hand with scripts; addresses committed | |
| Indexers | Envio hosted (EVM) | |

Gate: GitHub Actions. Nothing deploys unless CI is green. Details: `docs/operations/ci-cd.md`, `docs/operations/deployment.md`, `docs/operations/environments.md`.

## 8. Trust boundaries (summary)

- **The page is hostile.** The extension takes the request origin from the browser, not from the page; keys never leave the background context.
- **The API is untrusted by signers.** It is a check, not an authority: the signer applies the verdict and its expiry; the on-chain limit is the last line.
- **Providers are untrusted inputs.** Their answers are schema-checked; their absence is a finding.
- **LLMs never decide.** They explain or draft; the decision is copied from the engine, never from a model.

Full threat model: `docs/operations/security.md`.

## 9. Deep-dive documents

| Area | Doc |
|---|---|
| Product, users, scope | `docs/PRODUCT.md` |
| Packages, import rules, conventions | `docs/architecture/packages.md` |
| Engine: pipeline, effects, detectors, policy | `docs/architecture/engine.md` |
| Chain adapter contract, adding a chain | `docs/architecture/chain-adapters.md` |
| HTTP API + MCP | `docs/architecture/api.md` |
| Extension, web app, shared UI | `docs/architecture/frontend.md` |
| SDKs (`guard`, `agent-kit`) | `docs/architecture/sdk.md` |
| x402 | `docs/architecture/x402.md` |
| Contracts and deployments | `docs/architecture/contracts.md` |
| External providers | `docs/architecture/providers.md` |
| Per chain family | `docs/chains/` |
| CI/CD, deploy, env, security | `docs/operations/` |
| Decisions | `docs/decisions/` |
| What comes from which legacy repo | `docs/migration/porting-plan.md` |
