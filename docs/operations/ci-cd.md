# CI/CD

Status: **in progress** (`.github/workflows/ci.yml` runs docs/secrets checks and lint, typecheck, tests; build, contracts and release jobs come with their packages)
Last verified: 2026-11-07

GitHub Actions is the gate: nothing reaches staging or production unless CI is green on that commit.

## 1. Branches and environments

| Branch / ref | Deploys to | How |
|---|---|---|
| PR branches (`feat/…`, `fix/…`, `docs/…`, `chore/…`) | none (CI is the gate; `apps/web/vercel.json` builds only `main` and `release`) | — |
| `main` | **staging**: Render `baret-api-staging` (testnets; live), Vercel (`apps/web`, production branch `main` until T2.6) | Render `autoDeployTrigger: checksPass` (works: the deployed commit is shown by `/health`); Vercel branch domain |
| `release` | **production**: Render `baret-api`, Vercel production domain | only moved by the release workflow |
| tag `vX.Y.Z` | release workflow | see §3 |

`main` and `release` are protected: PR required, CI required, no force-push, linear history. `release` accepts only fast-forwards from the release workflow.

## 2. Workflows

| File | Trigger | Jobs | State |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR, push to `main` | `docs` (docs-check, secrets-check, import rules); `checks` (install, Biome, typecheck, Vitest, `pnpm build`); `build` (all apps, extension zips as artifact) | `docs` and `checks` live; `build` comes with the first app |
| `contracts-evm.yml` | PR/push touching `contracts/evm/**` | `forge fmt --check`, `forge build --sizes`, `forge test` (checkout with submodules: `forge-std` v1.17.0) | live |
| `contracts-stellar.yml` | `contracts/stellar/**` | `cargo fmt --check`, `clippy -D warnings`, `cargo test`, wasm build | Phase 3 |
| `contracts-casper.yml` | `contracts/casper/**` | Odra build + tests | Phase 4 |
| `contracts-near.yml` | PR/push touching `contracts/near/**` (and on demand) | `cargo fmt --check`, `cargo test` (Rust 1.95), `cargo near build non-reproducible-wasm`, the wasm's NEAR code hash (base58 of sha256) in the job summary, artifact `baret-near-vault-wasm` | live |
| `release.yml` | tag `v*` | §3 | Phase 2 |
| `keep-warm.yml` | every 10 min (cron `*/10 * * * *`; the job does nothing after 2026-11-30), and on demand | `GET /health` on the staging API, so the free Render instance does not sleep while NEAR HACKATHON judges call it (2026-11-14 → 25); then, when the repository secret `NEAR_MARKET_TOKEN` is set, one pass of the Agent Market worker (`pnpm --filter @baret/demo-near market-agent --once`), which delivers Baret's verdict to new hires. Removed when the API leaves Render's free plan | live |
| `chain-check.yml` | nightly cron | Live testnet checks: RPCs answer, deployed contracts still exist, one analyse per chain against staging | Phase 2 |

## 3. Release

1. Merge the changesets PR (versions + CHANGELOGs).
2. Tag `vX.Y.Z` on `main`.
3. `release.yml`: checks CI is green for the tagged commit → fast-forwards `release` to it (Render and Vercel production deploy) → publishes `@baret/core`, `@baret/guard`, `@baret/agent-kit` to npm with provenance → creates a GitHub Release with the Chrome and Firefox extension zips.
4. Post-deploy smoke test against production (`/health/ready`, one analyse per enabled chain). Failure → roll back by moving `release` to the previous tag.

## 4. Rules

- Actions pinned to a major version at minimum; third-party actions pinned to a SHA.
- `permissions: contents: read` by default; widen per job.
- Secrets only in GitHub Environments (`staging`, `production`), never in workflow files.
- CI must not need paid API keys; chain tests needing RPC keys run only in `chain-check.yml`.
