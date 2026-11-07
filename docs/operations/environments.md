# Environments and variables

Status: **planned** (no `.env.example` exists yet; `pnpm docs:check` will require every variable in any `.env.example` to appear here)
Last verified: 2026-11-07

## 1. Environments

| Environment | API | Web | Chains | Data |
|---|---|---|---|---|
| local | `http://localhost:8080` | `http://localhost:5173` | testnets (your own RPC keys) | in memory |
| staging | Render `baret-api-staging` | Vercel staging domain | testnets | in memory; free-tier providers |
| production | Render `baret-api` | Vercel production domain | mainnets (+ testnets) | shared store (Phase 6) |

## 2. Naming

- Chain variables: `CHAIN_<SLUG>_<NAME>`, where `<SLUG>` is the `envSlug` in the chain's registry file: `MONAD_TESTNET`, `MONAD`, `ARC_TESTNET`, `ARC`, `BASE_SEPOLIA`, `BASE`, `STELLAR_TESTNET`, `STELLAR`, `CASPER_TEST`, `CASPER`.
- Application variables: `BARET_*`. Provider variables: the provider's name (`NANSEN_*`, `KIMI_*`).
- Contract addresses are **not** variables; they come from `packages/chains/deployments/`.
- Legacy names not used: `MONAD_TESTNET_*`, `DELTAG_*`, generic `RPC_URL` / `CHAIN_ID`.

## 3. `apps/api` variables (target)

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | default 8080 |
| `LOG_LEVEL` | no | `info` |
| `BARET_ENV` | yes | `local`, `staging`, `production` |
| `CHAIN_<SLUG>_RPC_URL` | enables the chain | main RPC (EVM JSON-RPC, Stellar RPC, Casper node RPC) |
| `CHAIN_<SLUG>_TRACE_RPC_URL` | EVM, no | node for `debug_traceCall` when the main RPC lacks it |
| `CHAIN_<SLUG>_HORIZON_URL` | Stellar | Horizon endpoint |
| `CHAIN_<SLUG>_SPECULATIVE_URL` | Casper, no | speculative execution endpoint (if Phase 4 confirms one) |
| `CHAIN_<SLUG>_INDEXER_URL` | no | indexer GraphQL for `/v1/audit/*` |
| `BARET_API_KEYS` | production | comma-separated static keys |
| `BARET_CORS_ORIGINS` | staging, production | comma-separated origins |
| `BARET_RATE_LIMIT_PER_MINUTE` | no | per IP, default 120 |
| `BARET_REQUEST_TIMEOUT_MS` | no | default 8000 |
| `BARET_VERDICT_TTL_SECONDS` | no | default 30 |
| `BARET_ATTESTATION_KEY` | no | ed25519 key for signed verdicts (planned) |
| `NANSEN_API_KEY`, `NANSEN_MODE`, `NANSEN_LABELS_DAILY_LIMIT` | no | reputation (EVM) |
| `CLEANVERSE_*` | no | compliance |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `BARET_LLM_DAILY_LIMIT` | no | `/v1/explain`, `/v1/policy/draft` (provider choice open) |
| `X402_*` | no | seller side, Phase 6 |

## 4. `apps/web` and `apps/extension` (build-time)

| Variable | Description |
|---|---|
| `VITE_BARET_API_URL` (web) | API base; in Vercel normally `/api` (rewrite) |
| `WXT_BARET_API_URL` (extension) | API base embedded in the build |
| `VITE_ENABLED_FAMILIES` / `WXT_ENABLED_FAMILIES` | `evm,stellar,casper` — which families a build exposes |

## 5. Secrets inventory (where each lives)

| Secret | Lives in |
|---|---|
| RPC keys, provider keys, `BARET_API_KEYS` | Render dashboard (per service) |
| npm publish (or trusted publishing) | GitHub Environment `production` |
| Deployer keys | developer machine / hardware wallet; never in any service |
| Relayer / demo agent keys (testnet only) | Render dashboard, staging only |
