# 0010 — Demo sites keep their chain code in a demo package per family

Status: Accepted
Date: 2026-11-08
Deciders: Ezgin (owner chose option 1 when asked, 2026-11-08)

## Context
The web app's threat showcase (`apps/web`, T2.4) runs fake dApps against real testnet contracts. In Metropolis these sites built their transactions with viem and connected wallets with wagmi, inside the showcase app. ADR-0003 and `tooling/import-rules.mjs` let only `packages/chain-<family>` import a chain library, so the sites cannot be ported as they were. Stellar and Casper scenarios will follow with their own libraries.

## Options
1. **A demo package per family** (`packages/demo-evm`, later `demo-stellar`, `demo-casper`) that may use its family's chain libraries, as a real dApp would. It holds the demo addresses (read from `packages/chains`), the transaction and payment builders, the analyze bodies and the wallet connection for its sites. `apps/web` keeps the screens.
2. A path exception inside `apps/web` (`src/sites/evm/**` may import viem).
3. A separate app per family's showcase, with its own deploy.

## Decision
Option 1. `packages/demo-evm` may import `core`, `chains` and the EVM chain libraries (viem, wagmi); `apps/web` may import `demo-evm`. The import-rules script knows demo packages (`DEMO_FAMILY`) and lets each use only its own family's libraries. Demo addresses are data: the `showcase` section of `packages/chains/deployments/<chain>.json`, where `listed` marks the contracts Baret vouches for (they join the chain's known contracts in the API) and attack contracts and reported wallets are never listed.

## Consequences
- The rule "apps never import a chain library" stays without exceptions; the demo code that does is in one reviewable place per family.
- A demo package is not a dependency of the engine, the API or the extension. It is test fixtures that happen to run in a browser.
- The demo contracts' "listed" status is visible in one file and covered by a test (no attack address is ever listed).
