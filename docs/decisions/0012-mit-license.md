# 0012 — The whole repository is MIT

Status: Accepted
Date: 2026-11-09
Deciders: Ezgin (owner, 2026-11-09: "the whole repo is MIT, if NEAR wants it"; NEAR HACKATHON asks for a licence and recommends MIT)

## Context
D3 (2026-11-07, TASKS.md) made the core proprietary and only the published SDKs (`core`, `guard`, `agent-kit`) MIT. ADR-0011 makes the repository public for NEAR HACKATHON 2026, whose rules ask for a licence and recommend MIT. A public repository whose root licence says "proprietary and confidential" contradicts itself and reads badly to judges.

## Decision
Every file in the repository is under the MIT License (root `LICENSE`, copyright Ezgin Çapkan). `package.json` and `Cargo.toml` say `MIT`. This supersedes D3 and point 5 of ADR-0011 ("the root licence stays as decided in D3"). Vendored code keeps its own licence (`contracts/evm/lib/forge-std`).

## Consequences
- Anyone may use, copy and change the code, including the engine, the detectors and the contracts. What stays Baret's is the hosted service, its data (reputation registry, policies) and the brand.
- The per-package MIT files in `packages/core` and `packages/guard` stay; they now match the root.
- Code the owner wants to keep closed later goes in a separate private repository, not here.

## Alternatives considered
- **Keep D3 (proprietary root, public repo):** the repository would be readable but not usable; contradicts NEAR's recommendation.
- **MIT for the NEAR part only:** mixed licences per folder are harder to read and to keep right; the owner chose the whole repository.
