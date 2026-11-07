# Architecture decisions (ADRs)

Status: **live**
Last verified: 2026-11-07

One file per decision: `NNNN-short-title.md`. An ADR is never edited to reverse it; a new ADR supersedes it and both link to each other. `pnpm docs:check` fails if an ADR file is missing from this table.

**Status values:** `Proposed` (written, waiting for the owner), `Accepted`, `Superseded by NNNN`, `Rejected`.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-clean-repository.md) | A new clean repository; legacy repos are sources | Accepted |
| [0002](0002-caip-identifiers.md) | CAIP-2 / CAIP-10 / CAIP-19 identifiers | Accepted |
| [0003](0003-engine-and-family-adapters.md) | One chain-agnostic engine, one adapter per chain family | Accepted |
| [0004](0004-one-multichain-wallet.md) | One multichain wallet from one seed | Accepted |
| [0005](0005-optional-providers.md) | External providers are optional and ported selectively | Accepted |
| [0006](0006-unified-codes-and-policy-v2.md) | Unified finding codes and GuardPolicy v2 | Accepted |
| [0007](0007-english-in-repository.md) | English in the repository | Accepted |
| [0008](0008-hosting-and-environments.md) | Vercel + Render + GitHub Actions; `main` = staging, `release` = production | Accepted |
| [0009](0009-docs-as-code.md) | Docs as code, enforced by CI and a session hook | Accepted |

## Template

```markdown
# NNNN — Title

Status: Proposed | Accepted | Superseded by NNNN | Rejected
Date: YYYY-MM-DD
Deciders: …

## Context
What forces the decision; what the legacy repos did.

## Decision
What we do.

## Consequences
What gets easier, what gets harder, what we must now do (tasks).

## Alternatives considered
Each with why not.
```
