# API (`apps/api`)

Status: **in progress** — Phase 1 routes built in `apps/api` and checked live against Monad testnet (2026-11-07); not deployed yet (T2.5)
Last verified: 2026-11-07

The engine as an HTTP service and an MCP server. One process serves every enabled chain (modular monolith). It is deployed on Render (`docs/operations/deployment.md`).

## 1. Stack

Fastify + TypeScript, Zod for every request and response, pino logs (JSON), `@fastify/rate-limit`, `@fastify/cors`. `tsx` in development; in production an esbuild bundle, `node dist/main.js` (`apps/api/scripts/build.mjs`; Metropolis ran `tsx` in production).

## 2. Routes (target)

| Method | Path | Purpose | Phase |
|---|---|---|---|
| GET | `/health` | Liveness, running commit, `forwardedHops` (count of X-Forwarded-For entries, to set the proxy hops) — **built** | 1 |
| GET | `/health/ready` | Per enabled chain: RPC reachable, right chain, simulation mode — **built** (provider flags come with T1.7) | 1 |
| GET | `/v1/chains` | Enabled chains and their capabilities (`docs/architecture/chain-adapters.md` §6) — **built** | 1 |
| POST | `/v1/analyze` | One transaction / message → `Verdict` — **built** | 1 |
| GET | `/v1/policy/templates?chain=` | Templates filled for one chain — **built** | 1 |
| POST | `/v1/market/webhook` | NEAR Agent Market events (ADR-0013): only when `NEAR_MARKET_TOKEN` and `NEAR_MARKET_WEBHOOK_SECRET` are set. Authenticated by the market's HMAC signature (`X-Market-Signature` over `<timestamp>.<raw body>`, timestamp within 5 min), not by API key; 401 otherwise. `hire.created` → 202 at once, then the brief is analysed in process and the verdict delivered; a repeated `X-Market-Delivery` → 200 `duplicate`; other events → 200 `ignored` — **built** | NEAR |
| POST | `/v1/explain` | Plain-language explanation of a verdict this server returned (LLM; decision copied, never generated) | 2 |
| POST | `/v1/policy/draft` | Rules proposed from a sentence (LLM; a proposal only) | 2 |
| GET | `/v1/audit/*` | History from the indexer of a chain that has one; 503 per chain otherwise, never an empty list | 2 |
| POST | `/mcp` | Baret checks as MCP tools for agents | 2 |
| POST | `/v1/analyze/batch` | Several requests, one answer each | 6 |
| — | x402 paywall on `/v1/analyze` | Pay per check without an API key | 6 |
| POST/GET | `/v1/keys` | Self-serve API keys and usage | 6 |

`/v1/analyze` body:

```json
{
  "chain": "eip155:10143",
  "request": { "kind": "transaction", "tx": { "from": "0x…", "to": "0x…", "data": "0x…", "value": "0" } },
  "policyTemplate": "balanced",
  "account": "eip155:10143:0x…",
  "payment": { "origin": "https://…", "requirements": { } , "spendHistory": [] },
  "integratorRequestId": "optional"
}
```

`policy` (full `GuardPolicy` v2) or `policyTemplate`; neither → `balanced`.

## 3. Errors

One envelope: `{ "error": { "code", "message", "details"? } }`.

| HTTP | code | When |
|---|---|---|
| 400 | `invalid_request` | Body off schema, zero address, wrong chain id inside the transaction, … |
| 400 | `chain_unsupported` | Chain unknown or not enabled on this deployment |
| 401 / 402 | `unauthorized` / `payment_required` | No key and no x402 payment (when the API is not open) |
| 429 | `rate_limited`, `daily_limit` | Limits |
| 503 | `rpc_unavailable` | The chain cannot be read or answers as another chain — **never a verdict** |
| 503 | `<feature>_unavailable` | Optional feature not configured or its provider failed |

Clients treat any non-2xx as **Blocked** ("Can't reach Baret").

## 4. Auth and limits

- Development: open. Staging: open with IP limits. Production: `x-api-key` (static keys from env first, managed keys in Phase 6) or x402 payment.
- Per-IP limit everywhere, per-key limit when a key is used, stricter per-route limits on LLM and write routes, daily budgets on anything that costs money (LLM calls, paid provider lookups).
- CORS: explicit origin list per environment.
- Before mainnet the per-IP bucket must be correct behind Render's proxy (Metropolis G-01: every visitor shared one bucket).

## 5. Configuration

Every variable is listed in `docs/operations/environments.md`; `apps/api/src/config.ts` validates them at start-up and refuses to boot on an invalid value. A chain is enabled when its RPC URL variable is set. Optional features are enabled when their keys are set, and `/health/ready` shows which.

## 6. State

In memory for now (verdict cache for `/v1/explain`, LLM answer cache, rate-limit buckets, daily budgets). Before production with more than one instance this moves to a shared store (decision pending, `TASKS.md`). Audit history comes from indexers, never from the API's memory.

## 7. Not built yet

Every route from phase 2 on; managed keys; a shared store.
