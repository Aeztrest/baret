# @baret/api

The Baret HTTP API: `@baret/engine` over HTTP for every enabled chain. Deployed on Render (`docs/operations/deployment.md`). Routes, errors and limits: `docs/architecture/api.md`.

```bash
cp apps/api/.env.example apps/api/.env      # set CHAIN_MONAD_TESTNET_RPC_URL at least
pnpm --filter @baret/api dev                 # tsx watch, :8080
pnpm --filter @baret/api build               # dist/main.js (esbuild bundle)
pnpm --filter @baret/api start               # node dist/main.js — what production runs
```

| File | What it does |
|---|---|
| `src/main.ts` | Composition root: config → per-chain RPC and sources → `createEvmAdapter` → `createEngine` → HTTP |
| `src/app.ts` | Fastify app: CORS, per-client rate limit, security headers, API keys, the error envelope, the routes |
| `src/config.ts` | Every environment variable, validated at start-up; enabled chains from `CHAIN_<SLUG>_RPC_URL` |
| `src/client.ts` | Which X-Forwarded-For entry is the client (ported from Metropolis; fixes the shared-bucket problem G-01) |
| `scripts/build.mjs` | esbuild bundle: this app's own dependencies stay external, everything else (workspace packages, viem, zod) is bundled |

Known contracts come from the chain registry's deployments (`packages/chains/deployments`), not from a variable. The reputation provider and the compliance source are off until T1.7; the on-chain ReputationRegistry is read when the chain has one.

**Checked live on 2026-11-07** (bundle started with `node dist/main.js` against `https://testnet-rpc.monad.xyz`): `/health/ready` ready with trace; a plain MON transfer → Safe (high confidence, traced, fee included in the balance change); an unlimited USDC approval to the NovaSwap drainer → Blocked by `APPROVAL_UNLIMITED` and `KNOWN_MALICIOUS_ADDRESS` (read from the on-chain registry). `LOOKALIKE_ADDRESS` needs the NovaSwap router in the registry, which comes with the showcase contracts (T2.4).

Tests: `pnpm --filter @baret/api test` (HTTP layer with a fake adapter; no network).
