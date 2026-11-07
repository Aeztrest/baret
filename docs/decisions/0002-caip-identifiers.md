# 0002 — CAIP-2 / CAIP-10 / CAIP-19 identifiers

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner), 2026-11-07

## Context
Metropolis keyed everything by EVM chain id (`10143`), Baret-Stellar by network name, CasperBaret by chain name (it already used `casper:casper-test` for x402). x402 itself uses CAIP-2 network ids.

## Decision
Outside the adapters, chains are CAIP-2 strings, accounts CAIP-10, assets CAIP-19. Adapters convert to and from native forms. Exact Stellar and Casper asset namespaces are fixed in Phase 1 and written in `docs/architecture/engine.md` §2.

## Consequences
One key type for caches, policies, provider lookups and UI; x402 networks map directly. Slightly longer strings in the API.

## Alternatives considered
Internal slugs (`monad-testnet`): simpler but non-standard and ambiguous for integrators.
