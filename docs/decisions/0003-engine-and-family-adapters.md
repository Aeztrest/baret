# 0003 — One chain-agnostic engine, one adapter per chain family

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner), 2026-11-07

## Context
The legacy repos implement the same idea (decode → simulate → detect → policy → verdict) three times with different shapes. EVM chains differ only in configuration; Stellar and Casper differ in transaction model.

## Decision
- `packages/engine` runs the pipeline over a common `Effects` model. Each family is one package (`chain-evm`, `chain-stellar`, `chain-casper`) with an `./engine` entry (server) and a `./wallet` entry (client). Chains within a family are registry data.
- `apps/api` is a single service serving every enabled chain (modular monolith). It can be split per family later without changing the packages.
- Import rules (`docs/architecture/packages.md` §4) are enforced in CI.

## Consequences
Adding an EVM chain is configuration; adding a family is one package. The `Effects` model must be designed carefully and changed only by ADR. One service is simpler to run; a failing family adapter must not take the others down (per-chain health, per-chain errors).

## Alternatives considered
- One service per family: more operations work for one developer; no benefit yet.
- Port each legacy server side by side behind a router: keeps three policy models and three verdict shapes; rejected.
