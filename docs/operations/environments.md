# Environments and variables

Status: **in progress** (`apps/api/.env.example` exists; `pnpm docs:check` requires every variable in any `.env.example` to appear here)
Last verified: 2026-11-07

## 1. Environments

| Environment | API | Web | Chains | Data |
|---|---|---|---|---|
| local | `http://localhost:8080` | `http://localhost:5173` | testnets (your own RPC keys) | in memory |
| staging | Render `baret-api-staging`: https://baret-api-staging.onrender.com (live since 2026-11-07, free plan: sleeps when idle) | Vercel `baret`: https://usebaret.com (custom domain since 2026-11-14, moved from the Metropolis project; `www` redirects to it; also https://baret-nine.vercel.app) | Monad testnet | in memory; no paid providers yet |
| production | Render `baret-api` | Vercel production domain | mainnets (+ testnets) | shared store (Phase 6) |

## 2. Naming

- Chain variables: `CHAIN_<SLUG>_<NAME>`, where `<SLUG>` is the `envSlug` in the chain's registry file: `MONAD_TESTNET`, `MONAD`, `ARC_TESTNET`, `ARC`, `BASE_SEPOLIA`, `BASE`, `STELLAR_TESTNET`, `STELLAR`, `CASPER_TEST`, `CASPER`, `NEAR_TESTNET`, `NEAR_MAINNET`.
- Application variables: `BARET_*`. Provider variables: the provider's name (`NANSEN_*`, `KIMI_*`).
- Contract addresses are **not** variables; they come from `packages/chains/deployments/`.
- Legacy names not used: `MONAD_TESTNET_*`, `DELTAG_*`, generic `RPC_URL` / `CHAIN_ID`.

## 3. `apps/api` variables (target)

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | default 8080 |
| `HOST` | no | default `0.0.0.0` |
| `LOG_LEVEL` | no | `info` |
| `BARET_ENV` | no | `local` (default), `staging`, `production`; production refuses to start without `BARET_API_KEYS` |
| `CHAIN_<SLUG>_RPC_URL` | enables the chain | main RPC (EVM JSON-RPC, Stellar RPC, Casper node RPC) |
| `CHAIN_<SLUG>_TRACE_RPC_URL` | EVM, no | node for `debug_traceCall` when the main RPC lacks it |
| `CHAIN_<SLUG>_HORIZON_URL` | Stellar | Horizon endpoint |
| `CHAIN_NEAR_TESTNET_RPC_URL`, `CHAIN_NEAR_MAINNET_RPC_URL` | NEAR | JSON-RPC endpoint (staging: FastNEAR `https://test.rpc.fastnear.com` / `https://free.rpc.fastnear.com`; `rpc.<network>.near.org` is rate limited and answered in about 3 s on 2026-11-09, which made analyses time out); setting it serves the chain |
| `CHAIN_<SLUG>_SPECULATIVE_URL` | Casper, no | speculative execution endpoint (if Phase 4 confirms one) |
| `CHAIN_<SLUG>_INDEXER_URL` | no | indexer GraphQL for `/v1/audit/*` |
| `BARET_API_KEYS` | production | comma-separated static keys |
| `BARET_CORS_ORIGINS` | staging, production | comma-separated origins |
| `BARET_RATE_LIMIT_PER_MINUTE` | no | per IP, default 120 |
| `BARET_REQUEST_TIMEOUT_MS` | no | default 8000 |
| `BARET_VERDICT_TTL_SECONDS` | no | default 30 |
| `BARET_PROXY_DIRECT_HOPS` | staging, production | X-Forwarded-For entries the host's proxy adds on a direct request; unset: Fastify's `req.ip` (`apps/api/src/client.ts`) |
| `BARET_PROXY_EDGE_HOPS` | with the web app | entries on a request through the web app's rewrite |
| `BARET_EDGE_SECRET` | with the web app | shared secret the web app's edge sends in `x-baret-edge`; same value on the Vercel project |
| `NEAR_MARKET_TOKEN` | with the market webhook | the Baret agent's NEAR Agent Market token (`aat_…`, secret); set together with the next one or not at all (the API refuses to start with only one) |
| `NEAR_MARKET_WEBHOOK_SECRET` | with the market webhook | the webhook signing secret from the agent's Edit page (`whsec_…`, 32+ characters, secret); both set: `POST /v1/market/webhook` exists (ADR-0013) |
| `NEAR_MARKET_API` | no | the Agent Market API (default `https://market.near.ai`) |
| `BARET_ATTESTATION_KEY` | no | ed25519 key for signed verdicts (planned) |
| `NANSEN_API_KEY`, `NANSEN_MODE`, `NANSEN_LABELS_DAILY_LIMIT` | no | reputation (EVM) |
| `CLEANVERSE_*` | no | compliance |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `BARET_LLM_DAILY_LIMIT` | no | `/v1/explain`, `/v1/policy/draft` (provider choice open) |
| `X402_*` | no | seller side, Phase 6 |

## 4. `apps/web` and `apps/extension` (build-time)

| Variable | Description |
|---|---|
| `VITE_BARET_API_URL` (web) | API base; in Vercel normally `/api` (rewrite). Not read yet: the landing calls no API |
| `BARET_EDGE_SECRET` (web, Vercel runtime) | read by `apps/web/middleware.ts`; must equal the API's |
| `BARET_SITE_URL` (web) | absolute site URL for canonical, og:url, sitemap; on Vercel defaults to the production domain |
| `BARET_DEV_API` (web, dev only) | where `vite dev` proxies `/api`; default `http://localhost:8080` (apps/api), or the staging URL to try the demos without a local API |
| `BARET_REQUIRE_SITE_URL` (web) | `1` makes a build without a site URL fail (a Vercel production build always does) |
| `BARET_SOURCEMAPS` (web) | `1` writes hidden source maps (off by default) |
| `WXT_BARET_API_URL` (extension) | API base embedded in the build |
| `VITE_ENABLED_FAMILIES` / `WXT_ENABLED_FAMILIES` | `evm,stellar,casper` — which families a build exposes |

## 4b. `packages/demo-near` (local only, `.env.near` and `.env.agent`, gitignored)

The NEAR demo's scripts and agent (`packages/demo-near/README.md`). Testnet only; the scripts stop on any other network. Two files for two parties: the owner's setup scripts read `.env.near` (all of the table below); `pnpm agent-key` writes `.env.agent` with `NEAR_NETWORK`, `NEAR_AGENT_ID`, `NEAR_AGENT_FC_KEY`, `NEAR_VAULT_ID`, `NEAR_SHOP_ID` and, when set, `NEAR_RPC_URL`, `BARET_API_URL`, `NEAR_ATTACKER_ID`, `NEAR_MARKET_TOKEN`, `NEAR_MARKET_API`. The agent process (`pnpm agent`, `pnpm market-agent`) reads only those names, from `.env.agent` or the environment (`src/agent-env.ts`), and refuses to start if `NEAR_OWNER_KEY`, `NEAR_VAULT_KEY` or `NEAR_AGENT_KEY` is in `.env.agent`.

| Variable | Description |
|---|---|
| `NEAR_NETWORK` | `testnet` (default; nothing else runs) |
| `NEAR_RPC_URL` | default FastNEAR (`https://test.rpc.fastnear.com`, mainnet `https://free.rpc.fastnear.com`) |
| `BARET_API_URL` | the API the agent asks (default staging) |
| `NEAR_OWNER_ID`, `NEAR_OWNER_KEY` | the funded testnet owner and its full access key (secret) |
| `NEAR_VAULT_ID/KEY`, `NEAR_AGENT_ID/KEY`, `NEAR_SHOP_ID/KEY`, `NEAR_AGENT_FC_KEY` | written by `pnpm keys` (secrets) |
| `NEAR_ATTACKER_ID` | optional: the account a prompt injection names |
| `NEAR_INTENTS_ACCOUNT` | `pnpm intents-check` only: a NEAR **mainnet** account holding some wNEAR; the check signs nothing |
| `NEAR_INTENTS_OTHER` | optional, `pnpm intents-check` only: the mainnet account the hostile quote pays (default `relay.near`) |
| `NEAR_INTENTS_API` | optional: the 1Click API (default `https://1click.chaindefuser.com`) |
| `NEAR_MARKET_TOKEN` | `pnpm market-agent` only: the Baret agent's NEAR Agent Market token (`aat_…`, secret; acts only as that agent) |
| `NEAR_MARKET_API` | optional: the Agent Market API (default `https://market.near.ai`) |

## 5. Secrets inventory (where each lives)

| Secret | Lives in |
|---|---|
| RPC keys, provider keys, `BARET_API_KEYS` | Render dashboard (per service) |
| `NEAR_MARKET_TOKEN`, `NEAR_MARKET_WEBHOOK_SECRET` | Render dashboard (staging); the token also as the GitHub repository secret `NEAR_MARKET_TOKEN` (the fallback poller) |
| npm publish (or trusted publishing) | GitHub Environment `production` |
| Deployer keys | developer machine / hardware wallet; never in any service |
| Relayer / demo agent keys (testnet only) | Render dashboard, staging only |
