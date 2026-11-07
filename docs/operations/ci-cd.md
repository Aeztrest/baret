# CI/CD

Status: **in progress** (`.github/workflows/ci.yml` runs docs/secrets checks and lint, typecheck, tests; build, contracts and release jobs come with their packages)
Last verified: 2026-11-07

GitHub Actions is the gate: nothing reaches staging or production unless CI is green on that commit.

## 1. Branches and environments

| Branch / ref | Deploys to | How |
|---|---|---|
| PR branches (`feat/…`, `fix/…`, `docs/…`, `chore/…`) | Vercel preview (web) | automatic per PR |
| `main` | **staging**: Render `baret-api-staging` (testnets), Vercel staging domain | Render `autoDeployTrigger: checksPass`; Vercel branch domain |
| `release` | **production**: Render `baret-api`, Vercel production domain | only moved by the release workflow |
| tag `vX.Y.Z` | release workflow | see §3 |

`main` and `release` are protected: PR required, CI required, no force-push, linear history. `release` accepts only fast-forwards from the release workflow.

## 2. Workflows

| File | Trigger | Jobs | State |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR, push to `main` | `docs` (docs-check, secrets-check, import rules); `checks` (install, Biome, typecheck, Vitest); `build` (all apps, extension zips as artifact) | `docs` and `checks` live; `build` comes with the first app |
| `contracts-evm.yml` | PR/push touching `contracts/evm/**` | `forge fmt --check`, `forge build --sizes`, `forge test` | Phase 1 |
| `contracts-stellar.yml` | `contracts/stellar/**` | `cargo fmt --check`, `clippy -D warnings`, `cargo test`, wasm build | Phase 3 |
| `contracts-casper.yml` | `contracts/casper/**` | Odra build + tests | Phase 4 |
| `release.yml` | tag `v*` | §3 | Phase 2 |
| `chain-check.yml` | nightly cron | Live testnet checks: RPCs answer, deployed contracts still exist, one analyse per chain against staging | Phase 2 |
| `keep-warm.yml` | cron, only while the API is on Render's free plan | ping `/health` | Phase 2 (removed on a paid plan) |

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
