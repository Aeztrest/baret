# Baret

**A transaction firewall for wallets, dApps and AI agents — on EVM, Stellar and Casper.**

Before anything is signed, Baret decodes and simulates the transaction, runs risk detectors over what it would actually do, applies the owner's own policy and answers `safe`, `caution` or `blocked`, with reasons and the exact balance changes. For agents, an on-chain spend limit bounds what a key can pay, even if the agent is compromised.

> **Status: foundation phase.** This repository is the multichain successor of six per-chain Baret builds (Monad, Stellar, Casper, GOAT, Midnight, Solana). The architecture and plan are written; code is being ported. Current phase and next tasks: [`TASKS.md`](TASKS.md).

## Documentation

| Start here | |
|---|---|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | What Baret is, for whom, and what it promises |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The map: layers, packages, flows, deployment |
| [`docs/chains/README.md`](docs/chains/README.md) | Supported chains and their status |
| [`docs/README.md`](docs/README.md) | Every document, and which code it owns |
| [`TASKS.md`](TASKS.md) | Where the project is and what comes next |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for contributors and coding agents |

## Repository layout (target)

```
apps/        api (Render) · extension (browser wallet) · web (Vercel)
packages/    core · chains · chain-evm · chain-stellar · chain-casper · engine · providers
             guard · agent-kit · wallet-core · content · ui · web-ui
contracts/   evm (Foundry) · stellar (Soroban) · casper (Odra)
tooling/     docs and secrets checks, session hooks
docs/        architecture, chains, operations, decisions, migration
```

## Checks

```bash
node tooling/docs-check.mjs     # documentation consistency (also `pnpm docs:check`)
node tooling/secrets-check.mjs  # secret scan (also `pnpm secrets:check`)
```

Both run in CI on every pull request.
