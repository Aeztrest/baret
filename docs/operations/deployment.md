# Deployment

Status: **in progress** — staging API **live** on Render (https://baret-api-staging.onrender.com, from `render.yaml`, 2026-11-07); production API, Vercel and store publishing not set up yet
Last verified: 2026-11-07

Where each piece runs and how it gets there. Variables: `docs/operations/environments.md`. Pipeline: `docs/operations/ci-cd.md`.

## 1. Render — `apps/api`

Blueprint `render.yaml` at the repo root (pattern from `Baret-Metropolis/render.yaml`; today it defines `baret-api-staging` only — production is added when it is needed):

| Service | Branch | Plan | Chains |
|---|---|---|---|
| `baret-api-staging` | `main` | free → starter when demos depend on it | testnets |
| `baret-api` | `release` | starter or higher (no sleeping in production) | mainnets (+ testnets if useful) |

- Region Frankfurt. `autoDeployTrigger: checksPass`. `buildFilter` on `apps/api/**`, `packages/**`, lockfile, `render.yaml`.
- Build: `pnpm install --frozen-lockfile --filter @baret/api...` then `pnpm --filter @baret/api build`. Start: `node apps/api/dist/main.js` (built JS, not `tsx`). Checked 2026-11-07 in a fresh clone: 110 packages installed, bundle built, the server started and `/health/ready` was ready against Monad testnet.
- Set up by the owner on 2026-11-07 (Render → New → Blueprint → `Aeztrest/baret`). Checked live the same day: `/health` reports the deployed commit (`517f94e` = `main`), `/health/ready` ready with trace on Monad testnet, security headers present; the drainer's sink and the NovaSwap drainer approval Blocked, a plain transfer Safe; `@baret/guard` from its packed tarball got the same answers.
- Not done: the proxy-hop setting for per-client rate limits behind Render (T2.11).
- `healthCheckPath: /health`. Secrets are `sync: false` and entered in the Render dashboard.
- Free plan sleeps (first request 30–60 s; Metropolis G-03). Warm it before demos or use a paid plan.

## 2. Vercel — `apps/web`

- One Vercel project, root `apps/web`, `vercel.json` with install/build from the monorepo root (pattern from `Baret-Metropolis/apps/showcase/vercel.json`), security headers, long cache for hashed assets.
- Production branch: `release`. `main` → staging domain. PRs → previews pointing at the staging API.
- `/api/*` rewrites to the API of the same environment, so the browser talks to one origin.
- Domains: to decide (`TASKS.md`).

## 3. Extension

- CI builds Chrome and Firefox zips on every push; the release workflow attaches them to the GitHub Release (the install page links there).
- Store publishing (Chrome Web Store, Firefox AMO) is a manual step per release until volume justifies automation. Store listing text: port `Baret-Metropolis/docs/STORE_LISTING.md`.
- The build embeds the API URL of its environment; the production build grants host access to the production API only.

## 4. npm

`@baret/core`, `@baret/guard`, `@baret/agent-kit` via changesets in `release.yml`, with provenance. Scope ownership: to confirm.

## 5. Contracts

Deployed from a developer machine with the family's script; never from CI. Testnet: a dedicated deployer key. Mainnet: hardware wallet, owner/admin = multisig, after audit. Output recorded in `packages/chains/deployments/` in the same PR (`docs/architecture/contracts.md`).

## 6. Indexer

Envio hosted for EVM chains; one deployment per chain; its GraphQL URL is a variable of the API.
