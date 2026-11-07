# 0001 — A new clean repository; legacy repos are sources

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner), planning session

## Context
Six per-chain Baret repos exist (Metropolis/Monad in the HackerFetch org with two hackathon contributors' history; Stellar, Casper, GOAT, Midnight, BLACKTHORN under Aeztrest). The hub repo `Aeztrest/Baret-Multichain` is public and holds investor PDFs and the financial model. Metropolis's rules forbid any multichain abstraction (its D-003).

## Decision
The multichain product lives in a **new repository** with a fresh history (`baret`, under Ezgin's account or the company org). Code is copied from the legacy repos deliberately, file by file, following `docs/migration/porting-plan.md`. The hub repo stays the investor/planning hub; the legacy repos stay as they are (read-only references). Metropolis's D-003 does not apply here.

## Consequences
- Clean IP story: one owner, one history. Code written by Metropolis contributors (frontend by Meriç, tests/docs by Hale) is still their authorship: a written contribution + IP assignment from both should be signed before that code ships under the company (`TASKS.md` Phase 0).
- The reasons behind legacy code are not in this history: the porting plan names the legacy decision (e.g. Metropolis D-049) next to each ported part.

## Alternatives considered
- Monorepo inside the public hub repo: mixes financials with code; rejected.
- Continue in the Metropolis repo: carries the hackathon rules, history and org; rejected.
