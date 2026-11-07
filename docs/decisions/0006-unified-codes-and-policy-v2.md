# 0006 — Unified finding codes and GuardPolicy v2

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner), 2026-11-07

## Context
The same concept has a different code in each legacy repo (`ERC20_APPROVAL_UNLIMITED`, `SOROBAN_ALLOWANCE_UNLIMITED`, `CEP18_ALLOWANCE_UNLIMITED`); the Metropolis policy names USDC and Nansen directly and has only EVM fields.

## Decision
Universal concepts get one code (`APPROVAL_UNLIMITED` with `values.standard`), provider-neutral names (`REPUTATION_*`), and family-only concepts keep family codes. `GuardPolicy` v2 has `core` + optional `evm` / `stellar` / `casper` sections and names assets by CAIP-19. A `migratePolicyV1` function keeps saved v1 policies working. Tables: `docs/architecture/engine.md` §4–5.

## Consequences
Breaking change for `@baret/guard` 0.1.x users → the multichain line starts at 0.2.0. `packages/content` copy is re-keyed once.

## Alternatives considered
Keep legacy codes and add per-family duplicates: every client would need per-chain branches.
