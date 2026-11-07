# Packages, import rules and conventions

Status: **in progress** (built: `packages/core`; the rest is the target layout)
Last verified: 2026-11-07

Every app and package, what it may import, and the conventions that apply to all code. `pnpm docs:check` fails if an `apps/*` or `packages/*` directory is missing from the tables below.

## 1. Layout

```
baret/
├── apps/
│   ├── api/            Fastify HTTP API + MCP                         → Render
│   ├── extension/      multichain browser wallet (WXT, MV3)           → GitHub Release / stores
│   └── web/            landing, showcase, /agents, developer portal   → Vercel
├── packages/
│   ├── core/           types + zod schemas, adapter interfaces (no deps but zod)
│   ├── chains/         chain registry + deployments/*.json
│   ├── chain-evm/      EVM adapter            ./engine  ./wallet
│   ├── chain-stellar/  Stellar adapter        ./engine  ./wallet
│   ├── chain-casper/   Casper adapter         ./engine  ./wallet
│   ├── engine/         pipeline, universal detectors, policy evaluation
│   ├── providers/      reputation, compliance, prices, LLM clients
│   ├── guard/          @baret/guard — public SDK (published)
│   ├── agent-kit/      @baret/agent-kit — guarded agent wallet + CLI (published)
│   ├── wallet-core/    keyring, sessions, the check-then-sign flow (no UI)
│   ├── content/        every user-facing word, per language
│   ├── ui/             design tokens + React components
│   └── web-ui/         web-only layer (type, motion, layout) for apps/web
├── contracts/
│   ├── evm/            Foundry
│   ├── stellar/        Soroban (Rust workspace)
│   └── casper/         Odra (Rust)
├── tooling/            docs-check, secrets-check, import-rules check, hooks
└── docs/
```

## 2. Apps

| App | Purpose | Doc |
|---|---|---|
| `apps/api` | The engine over HTTP and MCP; auth, limits, x402 seller | `docs/architecture/api.md` |
| `apps/extension` | Multichain wallet with the check before every signature | `docs/architecture/frontend.md` |
| `apps/web` | Public site: landing, per-chain threat showcase, `/agents`, developer portal | `docs/architecture/frontend.md` |

## 3. Packages

| Package | npm name | Published | Purpose | Doc |
|---|---|---|---|---|
| `packages/core` | `@baret/core` | yes (dependency of guard) — **built** | Identifiers, units, Effects, findings, GuardPolicy v2 + templates + v1 migration, Verdict, chain config schema, adapter interfaces | `docs/architecture/engine.md` |
| `packages/chains` | `@baret/chains` | no | Registry of supported chains, features, deployments | `docs/chains/README.md` |
| `packages/chain-evm` | `@baret/chain-evm` | no | EVM decode/simulate/effects/detectors + wallet ops (viem) | `docs/chains/evm.md` |
| `packages/chain-stellar` | `@baret/chain-stellar` | no | Stellar adapter (`@stellar/stellar-sdk`) | `docs/chains/stellar.md` |
| `packages/chain-casper` | `@baret/chain-casper` | no | Casper adapter (`casper-js-sdk`) | `docs/chains/casper.md` |
| `packages/engine` | `@baret/engine` | no | Pipeline, universal detectors, policy evaluation | `docs/architecture/engine.md` |
| `packages/providers` | `@baret/providers` | no | Optional data sources and LLM client | `docs/architecture/providers.md` |
| `packages/guard` | `@baret/guard` | **yes** | Client for `/v1/analyze`, policy templates, verdict helpers | `docs/architecture/sdk.md` |
| `packages/agent-kit` | `@baret/agent-kit` | **yes** | `AgentWallet`, signers, x402 buyer, `baret` CLI | `docs/architecture/sdk.md` |
| `packages/wallet-core` | `@baret/wallet-core` | no | Keyring (seed → accounts per family), sessions, check-then-sign | `docs/architecture/frontend.md` |
| `packages/content` | `@baret/content` | no | Words for findings, policy fields, screens; languages | `docs/architecture/frontend.md` |
| `packages/ui` | `@baret/ui` | no | Design tokens, React components | `docs/architecture/frontend.md` |
| `packages/web-ui` | `@baret/web-ui` | no | Web-only signature layer | `docs/architecture/frontend.md` |

## 3b. Contracts

| Path | Toolchain | Doc |
|---|---|---|
| `contracts/evm` | Foundry | `docs/architecture/contracts.md`, `docs/chains/evm.md` |
| `contracts/stellar` | Soroban (Rust) | `docs/architecture/contracts.md`, `docs/chains/stellar.md` |
| `contracts/casper` | Odra (Rust) | `docs/architecture/contracts.md`, `docs/chains/casper.md` |

## 4. Import rules (to be enforced in CI by an import-rules script in `tooling/`, `TASKS.md` T1.4)

A package may import only from the packages in its row (plus external libraries listed).

| Package | May import | External chain libraries |
|---|---|---|
| `core` | — | none (zod only) |
| `chains` | `core` | none |
| `chain-<family>` | `core`, `chains` | its own family's library only |
| `providers` | `core` | none |
| `engine` | `core`, `chains`, `providers`, `chain-*/engine` (through the registry only) | none |
| `guard` | `core` | none |
| `agent-kit` | `core`, `guard`, `chains`, `chain-*/wallet` | via adapters only |
| `wallet-core` | `core`, `guard`, `chains`, `chain-*/wallet` | via adapters only |
| `content` | `core` (codes only) | none |
| `ui`, `web-ui` | `content` | none |
| `apps/api` | `engine`, `providers`, `chains`, `core`, `content` | none directly |
| `apps/extension` | `wallet-core`, `guard`, `ui`, `content`, `chains`, `core` | none directly |
| `apps/web` | `guard`, `ui`, `web-ui`, `content`, `chains`, `core`, `wallet-core` (demo signing) | none directly |

Two more rules:
- `chain-<family>/engine` and `chain-<family>/wallet` are separate entry points. The extension bundles only `./wallet`; the API only `./engine`.
- Shared code never contains `if (family === "evm")`. A difference between families is a method on the adapter interface.

## 5. Conventions

- **TypeScript** strict (`tsconfig.base.json`), ESM, `moduleResolution: bundler` for apps and libraries; Node 22.
- **pnpm workspaces**; internal deps as `workspace:*`. Exact versions for external deps; Renovate/Dependabot groups updates weekly (Phase 0 task).
- **Biome** for lint and format (config ported from Metropolis). **Vitest** for tests; each package has `test` and `typecheck` scripts.
- **Zod at every boundary**: env, HTTP request and response, storage reads, provider answers.
- **Errors**: one envelope `{ error: { code, message, details? } }` from the API; library errors are typed classes; never forward a raw upstream error message to a client.
- **Money**: integers in base units as strings in JSON (`"1000000"`), with the asset's decimals carried alongside. Never floats.
- **Time**: UNIX seconds in protocol fields, ISO-8601 in logs and docs.
- **Tests**: pure logic is unit-tested without network; chain tests (`test:chain`) are separate, opt-in, and need RPC env vars.
- Every package has a `README.md`: purpose, public API, how to test.
